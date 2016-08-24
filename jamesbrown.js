// Setup =================================================
// =======================================================

const setup                 = require('./bot-setup.js');
const responses             = require('./responses.js');

const Botkit                = require('botkit');
const SpotifyWebApi         = require('spotify-web-api-node');
const Spotify               = require('spotify-node-applescript');

const q                     = require('q');
const os                    = require('os');
const open                  = require('open');
const https                 = require('https');
const ngrok                 = require('ngrok');
const prompt                = require('prompt');
const request               = require('request');

const AUTHENTICATED_USER  = setup.spotify.userName;
const PLAYLIST_ID         = setup.spotify.playlistId;
const REPORTING_CHANNEL   = setup.slack.channel;


// Slack App =============================================
// =======================================================

if (!setup.slack.clientId || !setup.slack.clientSecret || !setup.server.port) {
  console.log('Error: Specify clientId clientSecret and port in environment');
  process.exit(1);
}

var controller = Botkit.slackbot({
  interactive_replies: true,
  json_file_store: './db_slackapp_bot/',
  debug: false,
  log: false
});

controller.configureSlackApp({
  clientId: setup.slack.clientId,
  clientSecret: setup.slack.clientSecret,
  scopes: ['bot', 'chat:write:user', 'chat:write:bot']
});

controller.setupWebserver(setup.server.port, function(err, webserver) {
  if (err) {
    throw new Error(err);
  }

  console.log('** Starting webserver on port ' + setup.server.port);
  console.log('** Serving webhook endpoints for Slash commands and outgoing webhooks at: http://MY_HOST:' + setup.server.port + '/slack/receive');
  controller.createWebhookEndpoints(controller.webserver);

  console.log('** Serving app landing page at : http://MY_HOST:' + setup.server.port + '/');
  controller.createHomepageEndpoint(controller.webserver);

  console.log('** Serving login URL: http://MY_HOST:' + setup.server.port + '/login');
  console.log('** Serving oauth return endpoint: http://MY_HOST:' + setup.server.port + '/oauth');
  controller.createOauthEndpoints(controller.webserver, function(err, req, res) {
    if (err) {
      res.status(500).send('ERROR: ' + err);
    } else {
      res.send('Great Success!');
    }
  });

  console.log('\nIf you haven\'t already, authorize your bot by visiting http://MY_HOST:' + setup.server.port + '/login\n');
});

var _bots = {};
var trackBot = function(bot) {
  _bots[bot.config.token] = bot;
};

controller.on('create_bot',function(bot, config) {
  if (_bots[bot.config.token]) {
    // already online! do nothing.
  } else {
    bot.startRTM(function(err) {
      if (!err) {
        trackBot(bot);
      }
      bot.startPrivateConversation({user: config.createdBy},function(err, convo) {
        if (err) {
          console.log(err);
        } else {
          convo.say(responses.welcome);
        }
      });
    });
  }
});

controller.storage.teams.all(function(err, teams) {
  if (err) {
    throw new Error(err);
  }
  for (var t in teams) {
    if (teams[t].bot) {
      controller.spawn(teams[t]).startRTM(function(err, bot) {
        if (err) {
          console.log('Error connecting bot to Slack:',err);
        } else {
          trackBot(bot);
        }
      });
    }
  }
});


// ngrok =================================================
// =======================================================

var setupNgrok = function() {
  ngrok.connect({
    proto: 'http',
    addr: setup.server.port,
    // subdomain: setup.server.subdomain,
    authtoken: setup.server.ngrokToken
  }, function (err, url) {
    if (err) {
      console.log('error initializing tunnel!');
      process.exit(1);
    }
    console.log('New tunnel! If you haven\'t already updated your interactive messages request url, please change it to: ' + url);
  });

  ngrok.once('error', function (url) {
    console.log('tunnel error!');
    ngrok.disconnect();
    setupNgrok();
  });
};


// Spotify App ===========================================
// =======================================================

// When our Spotify access token will expire
var tokenExpirationEpoch;

var scopes = ['playlist-read-private', 'playlist-read-collaborative', 'playlist-modify-public', 'playlist-modify-private'];
var state = '';

var spotifyApi = new SpotifyWebApi({
  redirectUri: setup.spotify.redirectUri,
  clientId: setup.spotify.clientId,
  clientSecret: setup.spotify.clientSecret
});

controller.on('rtm_open', function(bot) {
  console.log('** The RTM api just opened');

  setupNgrok();

  // Wait for the RTM to open so the console prompts don't get tangled up with one another

  var authCodeFlow = function() {
    open(spotifyApi.createAuthorizeURL(scopes, state));
    console.log('\nAuthorize and enter the resulting code attached to the redirect URI...');
    prompt.start();
    prompt.get(['auth_code'], function (err, result) {
      var code = result.auth_code.replace(/https?:.*code=/, '').replace(/[&\?]+?state=.*/, '');

      // Exchange provided auth code for tokens
      spotifyApi.authorizationCodeGrant(code).then(function(data) {

        // Receive, set, and store Spotify access and refresh tokens
        bot.identifyTeam(function(err, team_id) {
          controller.storage.teams.get(team_id, function(err, team_data) {
            team_data.spotifyRefreshToken = data.body.refresh_token;
            team_data.spotifyAccessToken = data.body.access_token;
            controller.storage.teams.save(team_data, function(err) {
              spotifyApi.setRefreshToken(team_data.spotifyRefreshToken);
              spotifyApi.setAccessToken(team_data.spotifyAccessToken);

              // Save the amount of seconds until the access token expired
              tokenExpirationEpoch = (new Date().getTime() / 1000) + data.body.expires_in;
              console.log('\nRetrieved token. It expires in ' + Math.floor(tokenExpirationEpoch - new Date().getTime() / 1000) + ' seconds!');
            });
          });
        });
      }, function(err) {
        throw new Error('There was something wrong with the provided auth code.');
      });
    });
  };

  controller.storage.teams.all(function(err, teams) {
    if (err) {
      throw new Error(err);
    }

    for (var t in teams) {
      // If access and refresh tokens are stored, set them
      if (teams[t].spotifyAccessToken && teams[t].spotifyRefreshToken) {
        spotifyApi.setAccessToken(teams[t].spotifyAccessToken);
        spotifyApi.setRefreshToken(teams[t].spotifyRefreshToken);

        spotifyApi.refreshAccessToken().then(function(data) {
          spotifyApi.setAccessToken(data.body.access_token);
          tokenExpirationEpoch = (new Date().getTime() / 1000) + data.body.expires_in;
          console.log('Retrieved token. It expires in ' + Math.floor(tokenExpirationEpoch - new Date().getTime() / 1000) + ' seconds!');
        }, function(err) {
          authCodeFlow();
        });
      } else {
        authCodeFlow();
      }
    }
  });
});


// Watchers ==============================================
// =======================================================

var lastTrackId;

var checkRunning = function() {
  var deferred = q.defer();
  Spotify.isRunning(function(err, isRunning) {
    if (err || !isRunning) {
      return deferred.resolve(false);
    }
    return deferred.resolve(true);
  });
  return deferred.promise;
};

var checkForTrackChange = function() {
  Spotify.getTrack(function(err, track) {
    if (track && (track.id !== lastTrackId)) {
      if (!REPORTING_CHANNEL) {
        return;
      }
      lastTrackId = track.id;
    }
  });
};

var tick = 0;
setInterval(function() {
  tick++;

  if (tick > 1500) {
    tick = 0;

    // Refresh token and print the new time to expiration.
    spotifyApi.refreshAccessToken()
      .then(function(data) {
        spotifyApi.setAccessToken(data.body.access_token);
        tokenExpirationEpoch = (new Date().getTime() / 1000) + data.body.expires_in;
        console.log('\nRefreshed token. It expires in ' + Math.floor(tokenExpirationEpoch - new Date().getTime() / 1000) + ' seconds!');
      }, function(err) {
        console.log('Could not refresh the token!', err.message);
      });
  }

  checkRunning()
  .then(function(running) {
    if (running) {
      checkForTrackChange();
    }
    else {
      if(lastTrackId !== null) {
        bot.say({
          text: 'Oh no! Where did Spotify go? It doesn\'t seem to be running 😨',
          channel: REPORTING_CHANNEL
        });
        lastTrackId = null;
      }
    }
  });
}, 1000);


// Helpers ===============================================
// =======================================================

var createTrackObject = function(data) {
  var artists = data.artists.map(function(artistObj) {
    return artistObj.name;
  }).join(', ');
  return {
    name: data.name,
    artist: artists,
    album: data.album.name,
    artworkUrls: {
      medium: data.album.images[1].url,
      small: data.album.images[2].url
    },
    formattedTrackTitle: '_' + data.name + '_ by *' + artists + '*',
    trackId: data.id
  };
};

var normalizeTrackId = function(rawTrackId) {
  var trackId = rawTrackId;
  if (rawTrackId.indexOf('spotify:track:') !== -1) {
    trackId = rawTrackId.split(':track:')[1];
  } else if (rawTrackId.indexOf('//open.spotify.com/track/') !== -1) {
    trackId = rawTrackId.split('/track/')[1];
  }
  return trackId;
};

var getRealNameFromId = function(bot, userId) {
  var deferred = q.defer();
  var realName = '';
  bot.api.users.info({user: userId}, function(err, response) {
    realName = response.user.real_name.toLowerCase();
    deferred.resolve(realName);
  });
  return deferred.promise;
};

var reorderPlaylist = function(trackInfo, trackPosition, currentTrackPosition) {
  spotifyApi.reorderTracksInPlaylist(AUTHENTICATED_USER, PLAYLIST_ID, trackPosition, currentTrackPosition + 1, {'range_length': 1});
};

var addTrack = function(trackInfo, currentTrackPosition) {
  spotifyApi.addTracksToPlaylist(AUTHENTICATED_USER, PLAYLIST_ID, 'spotify:track:' + trackInfo.trackId, {position: currentTrackPosition + 1});
};

var hotAdd = function(bot, trackInfo, user) {
  getRealNameFromId(bot, user).then(function(userName) {
    console.log(userName + ' added: ' + trackInfo.name + ' by ' + trackInfo.artist);
    spotifyApi.getPlaylist(AUTHENTICATED_USER, PLAYLIST_ID).then(function(data) {
      var playlistOrder = data.body.tracks.items.map(function(item) {
        return item.track.id;
      });
      Spotify.getState(function(err, state) {
        var currentTrackId = normalizeTrackId(state.track_id);
        var currentTrackPosition = playlistOrder.indexOf(currentTrackId);
        if (playlistOrder.indexOf(trackInfo.trackId) !== -1) {
          var trackPosition = playlistOrder.indexOf(trackInfo.trackId);
          reorderPlaylist(trackInfo, trackPosition, currentTrackPosition);
        } else {
          addTrack(trackInfo, currentTrackPosition);
        }
      });
    });
  });
};


// Listeners =============================================
// =======================================================

controller.on('interactive_message_callback', function(bot, message) {

  var action = message.actions[0];

  if (action.name === 'no' || action.name === 'nvm') {
    bot.replyInteractive(message, {
      text: 'maybe you\'ll work up the courage one day.'
    });
    return false;
  }

  if (message.callback_id === 'select_a_track') {
    var trackInfo = JSON.parse(action.value);
    bot.replyInteractive(message, responses.proceed(trackInfo));
  }

  if (message.callback_id === 'add_this_track') {
    getRealNameFromId(bot, message.user).then(function(userName) {
      var trackInfo = JSON.parse(action.value);
      console.log(userName + ' added: ' + trackInfo.name + ' by ' + trackInfo.artist);
      spotifyApi.getPlaylist(AUTHENTICATED_USER, PLAYLIST_ID).then(function(data) {
        var playlistOrder = data.body.tracks.items.map(function(item) {
          return item.track.id;
        });
        Spotify.getState(function(err, state) {
          var currentTrackId = normalizeTrackId(state.track_id);
          var currentTrackPosition = playlistOrder.indexOf(currentTrackId);
          if (playlistOrder.indexOf(trackInfo.trackId) !== -1) {
            var trackPosition = playlistOrder.indexOf(trackInfo.trackId);
            bot.replyInteractive(message, 'Moving ' + trackInfo.formattedTrackTitle + ' to the top of the queue.');
            reorderPlaylist(trackInfo, trackPosition, currentTrackPosition);
          } else {
            bot.replyInteractive(message, trackInfo.formattedTrackTitle + ' added to playlist.');
            bot.say(responses.addedToPlaylist(REPORTING_CHANNEL, userName, trackInfo));
            addTrack(trackInfo, currentTrackPosition);
          }
        });
      });
    });
  }
});

controller.hears([/search ([\s\S]+)/i], 'direct_message', function(bot, message) {

  var searchQuery = message.match[1];
  var searchResults = [];

  spotifyApi.searchTracks(searchQuery).then(function(data) {
    var results = data.body.tracks.items;

    if (results.length === 0) {
      bot.reply(message, 'Sorry, no results.');
      return false;
    }

    for (var i = 0; i < results.length; i++) {
      if (i >= 3) {
        break;
      }
      searchResults.push(createTrackObject(results[i]));
    }

    bot.reply(message, responses.searchResults(searchResults));

    }, function(err) {
      bot.reply(message, 'Looks like this error just happened: `' + err.message + '`');
    });
});


controller.hears([/add .*track[:\/](\d\w*)(>\s.*)?/i], 'direct_message', function(bot, message) {

  var trackId = normalizeTrackId(message.match[1]);
  var flag = (message.match[2] === undefined) ? false : message.match[2].substr(2);

  spotifyApi.getTrack(trackId).then(function(response) {
    var trackInfo = createTrackObject(response.body);
    if (flag == '-f') {  //bypass the confirmation prompt
      hotAdd(bot, trackInfo, message.user);
      bot.reply(message, 'Bypassing prompt...\nAttempting to add ' + trackInfo.formattedTrackTitle);
    } else {
      getRealNameFromId(bot, message.user).then(function(userName) {
        bot.reply(message, responses.proceed(trackInfo));
      });
    }
  }, function(err) {
    bot.reply(message, 'Looks like this error just happened: `' + err.message + '`');
  });
});


controller.hears(['/what\'?s next/', 'up next', 'next up', '/what\'?s up/'], 'direct_message,direct_mention', function(bot, message) {
  spotifyApi.getPlaylist(AUTHENTICATED_USER, PLAYLIST_ID)
    .then(function(data) {
      var playlist = data.body.tracks.items;
      var playlistOrder = playlist.map(function(item) {
        return item.track.id;
      });
      Spotify.getState(function(err, state) {
        var currentTrackId = normalizeTrackId(state.track_id);
        var currentTrackPosition = playlistOrder.indexOf(currentTrackId);
        var lastIndex = playlistOrder.length - 1;
        var nextThreeTracks = [];
        for (var i = 1; i <= 3; i++) {
          var nextIndex = currentTrackPosition + i;
          if (nextIndex - lastIndex >= 0) {
            nextIndex = nextIndex - lastIndex;
          }
          var artists = playlist[nextIndex].track.artists.map(function(artistObj) {
            return artistObj.name;
          }).join(', ');
          nextThreeTracks.push({
            name: playlist[nextIndex].track.name,
            artist: artists
          });
        }
        bot.reply(message, responses.upNext(nextThreeTracks));
      });
    });
});

controller.hears(['help'], 'direct_message', function(bot, message) {
  bot.reply(message, responses.help());
});

controller.hears(['info'], 'direct_message,direct_mention,mention', function(bot, message) {
  Spotify.getTrack(function(err, track){
    if (track) {
      bot.reply(message, responses.info(track));
    } else {
      bot.reply(message, 'sorry, no track.');
    }
  });
});

controller.hears(['detail'], 'direct_message,direct_mention,mention', function(bot, message) {
  Spotify.getTrack(function(err, track) {
    if (track) {
      var trackId = normalizeTrackId(track.id);
      spotifyApi.getTrack(trackId).then(function(response) {
        var trackInfo = createTrackObject(response.body);
        bot.reply(message, responses.detail(trackInfo));
      });
    } else {
      bot.reply(message, 'sorry, no track.');
    }
  });
});

controller.hears(['heysup'], 'direct_message,direct_mention,mention', function(bot, message) {
  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'radio',
  });
  bot.reply(message, 'Hello.');
});
