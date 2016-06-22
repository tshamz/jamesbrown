var setup            = require('./bot-setup.js');
var responses        = require('./responses.js');

var Botkit           = require('botkit');
var request          = require('request');
var SpotifyWebApi    = require('spotify-web-api-node');
var Spotify          = require('spotify-node-applescript');

var q                = require('q');
var os               = require('os');
var https            = require('https');


var AUTHENTICATED_USER = setup.spotify.userName;
var PLAYLIST_ID = setup.spotify.playlistId;


var controller = Botkit.slackbot({
    debug: false
});

controller.configureSlackApp({
  clientId: setup.slack.clientId,
  clientSecret: setup.slack.clientSecret,
  scopes: ['bot']
});

controller.setupWebserver(8080, function(err, webserver) {
  if (err) {
    throw new Error(err);
  }
  controller.createHomepageEndpoint(controller.webserver);
  controller.createOauthEndpoints(controller.webserver, function(err,req,res) {
    if (err) {
      res.status(500).send('ERROR: ' + err);
    } else {
      res.send('Success!');
    }
  });
});

var bot = controller.spawn({
    token: setup.slack.token
});

bot.startRTM(function(err) {
  if (err) {
    console.log('Even if you fall on your face, you\'re still moving forward.');
    throw new Error(err);
  }
});

var spotifyApi = new SpotifyWebApi({
  redirectUri: setup.spotify.redirectUri,
  clientId: setup.spotify.clientId,
  clientSecret: setup.spotify.clientSecret,
  accessToken: setup.spotify.accessToken,
  refreshToken: setup.spotify.refreshToken
});


// Authentication ===============================================

// When our access token will expire
var tokenExpirationEpoch;

spotifyApi.refreshAccessToken().then(function(data) {
  spotifyApi.setAccessToken(data.body['access_token']);
  tokenExpirationEpoch = (new Date().getTime() / 1000) + data.body['expires_in'];
  console.log('Retrieved token. It expires in ' + Math.floor(tokenExpirationEpoch - new Date().getTime() / 1000) + ' seconds!');
});


// var authorizationCode = "AQAW9K7cLNwJSrZro1fP0pdkYbOEu5EIwUYXnCgalJfbnwwovn2SSmkqZaw-eGz1KbmCT6Yw8_0nwN2bqfhgV0kep_boIFVoXcSmdo0BDeuVGGl72hlTLU412ny7q5r6-PVpkxXkhSkH3otuML7om83RW9L_whTOzELfZOjjWETk6_0dMSPmAg4Vx2VoyqcF-4YveYMQ62SZycbkFuW4Piuf40H34p62_w37zRqvjtRIfP_xoYa4Vru38NlwvZC5tVFHBEIOFrUsSdi-azOgzldK9HH0-ORsPG3tXcHB9wYtG5qNcSFhQa4FyzFpH9KBxgVBH-r-ihp_u3IbTw";

// spotifyApi.authorizationCodeGrant(authorizationCode).then(function(data) {
//   // Set the access token and refresh token
//   console.log('access token: ' + data.body['access_token']);
//   console.log('refresh token: ' + data.body['refresh_token']);

//   spotifyApi.setAccessToken(data.body['access_token']);
//   spotifyApi.setRefreshToken(data.body['refresh_token']);

//   // Save the amount of seconds until the access token expired
//   tokenExpirationEpoch = (new Date().getTime() / 1000) + data.body['expires_in'];
//   console.log('Retrieved token. It expires in ' + Math.floor(tokenExpirationEpoch - new Date().getTime() / 1000) + ' seconds!');
// }, function(err) {
//   console.log('Something went wrong when retrieving the access token!', err.message);
// });


// Initialization ===============================================

var init = function() {
  bot.api.channels.list({}, function(err, response) {
    if (response.hasOwnProperty('channels') && response.ok) {
      var total = response.channels.length;
      for (var i = 0; i < total; i++) {
        var channel = response.channels[i];
        if (verifyChannel(channel)) {
          return;
        }
      }
    }
  });

  bot.api.groups.list({}, function(err, response) {
    if (response.hasOwnProperty('groups') && response.ok) {
      var total = response.groups.length;
      for (var i = 0; i < total; i++) {
        var channel = response.groups[i];
        if (verifyChannel(channel)) {
            return;
        }
      }
    }
  });
};


// Watchers  ===============================================

var lastTrackId;
var channelId;

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
      if (!channelId) {
        return;
      }
      lastTrackId = track.id;
    }
  });
};

setInterval(function() {
  checkRunning()
  .then(function(running) {
    if (running) {
      checkForTrackChange();
    }
    else {
      if(lastTrackId !== null) {
        bot.say({
          text: 'Oh no! Where did Spotify go? It doesn\'t seem to be running 😨',
          channel: channelId
        });
        lastTrackId = null;
      }
    }
  });
}, 5000);

// Continually print out the time left until the token expires..
var tick = 0;
setInterval(function() {
  tick++;
  // console.log('tick: ' + tick);
  // we should probably refresh the token.
  if (tick > 1500) {
    tick = 0;

    // Refresh token and print the new time to expiration.
    spotifyApi.refreshAccessToken()
      .then(function(data) {
        spotifyApi.setAccessToken(data.body['access_token']);
        tokenExpirationEpoch = (new Date().getTime() / 1000) + data.body['expires_in'];
        console.log('Refreshed token.');
      }, function(err) {
        console.log('Could not refresh the token!', err.message);
      });
  }
}, 1000);


// Helper Functions ===============================================


var createTrackObject = function(data) {
  var artists = data.artists.map(function(artistObj) {
    return artistObj.name;
  });
  return {
    name: data.name,
    artist: artists.join(', '),
    album: data.album.name,
    artworkUrls: {
      medium: data.album.images[1].url,
      small: data.album.images[2].url
    },
    formattedTrackTitle: '_' + data.name + '_ by *' + artists.join(', ') + '*',
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

var verifyChannel = function(channel) {
  if(channel && channel.name && channel.id && setup.slack.channel && channel.name == setup.slack.channel) {
    channelId = channel.id;
    console.log('** ...chilling out on #' + channel.name);
    return true;
  }
  return false;
};

var logToConsole = function(userName, song, artists) {

  console.log(userName + ' just added: ' + song + ' by ' + artists.join(', '));
};

var reorderPlaylist = function(trackInfo, trackPosition, currentTrackPosition) {
  spotifyApi.reorderTracksInPlaylist(AUTHENTICATED_USER, PLAYLIST_ID, trackPosition, currentTrackPosition + 1, {"range_length": 1}).then(function(data) {
    logToConsole(userName, trackInfo.name, trackInfo.artists);
  });
};

var addTrack = function(trackInfo, currentTrackPosition) {
  spotifyApi.addTracksToPlaylist(AUTHENTICATED_USER, PLAYLIST_ID, 'spotify:track:' + trackInfo.trackId, {position: currentTrackPosition + 1}).then(function(response) {
    logToConsole(userName, trackInfo.name, trackInfo.artists);
  });
};


// Listeners  ===============================================

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

      var askChoice = function(response, convo) {
        convo.ask(responses.searchResults(searchResults), [{
          default: true,
          callback: function(response, convo) {
            convo.say('Sry, I didn\'t understand that. Pls try again');
            convo.next();
          }
        }, {
          pattern: bot.utterances.no,
          callback: function(response, convo) {
            convo.say('maybe you\'ll work up the courage one day.');
            convo.next();
          }
        }, {
          pattern: 'nvm',
          callback: function(response, convo) {
            convo.say('maybe you\'ll work up the courage one day.');
            convo.next();
          }
        }, {
          pattern: '([1-3])\.?',
          callback: function(response, convo) {
            var index = parseInt(response.match[1], 10) - 1;
            var result = searchResults[index];
            askIfSure(response, convo, result);
            convo.next();
          }
        }]);
      };

      var askIfSure = function(response, convo, trackInfo) {
        getRealNameFromId(bot, message.user).then(function(userName) {
          bot.startConversation(message, function(err, convo) {
            convo.say(responses.tryingToAdd(trackInfo));
            convo.ask(responses.proceed(), [{
              default: true,
              callback: function(response, convo) {
                convo.say('Sry, I didn\'t understand that. Pls try again');
                convo.next();
              }
            }, {
              pattern: bot.utterances.no,
              callback: function(response, convo) {
                convo.say('maybe you\'ll work up the courage one day.');
                convo.next();
              }
            }, {
              pattern: bot.utterances.yes,
              callback: function(response, convo) {
                updatePlaylist(trackInfo, userName);
                convo.next();
              }
            }]);
          });
        });
      };

      var updatePlaylist = function(trackInfo, userName) {
        spotifyApi.getPlaylist(AUTHENTICATED_USER, PLAYLIST_ID)
          .then(function(data) {
            var playlistOrder = data.body.tracks.items.map(function(item) {
              return item.track.id;
            });
            Spotify.getState(function(err, state) {
              var currentTrackId = normalizeTrackId(state.track_id);
              var currentTrackPosition = playlistOrder.indexOf(currentTrackId);
              if (playlistOrder.indexOf(trackInfo.trackId) !== -1) {
                var trackPosition = playlistOrder.indexOf(trackInfo.trackId);
                bot.reply(message, 'Moving your song to the top of the queue.');
                reorderPlaylist(trackInfo, trackPosition, currentTrackPosition);
              } else {
                bot.reply(message, 'Good News! I was able to successfully add your track to the playlist!');
                bot.say(responses.addedToPlaylist(channelId, userName, trackInfo));
                addTrack(trackInfo, currentTrackPosition);
              }
            });
          });
      };

      bot.startConversation(message, askChoice);

    }, function(err) {
      bot.reply(message, 'Looks like this error just happened: `' + err.message + '`');
    });
});


controller.hears([/add .*track[:\/](\d\w*)/i], 'direct_message', function(bot, message) {

  var trackId = normalizeTrackId(message.match[1]);

  var updatePlaylist = function(trackInfo, userName) {
    spotifyApi.getPlaylist(AUTHENTICATED_USER, PLAYLIST_ID)
      .then(function(data) {
        var playlistOrder = data.body.tracks.items.map(function(item) {
          return item.track.id;
        });
        Spotify.getState(function(err, state) {
          var currentTrackId = normalizeTrackId(state.track_id);
          var currentTrackPosition = playlistOrder.indexOf(currentTrackId);
          if (playlistOrder.indexOf(trackInfo.trackId) !== -1) {
            var trackPosition = playlistOrder.indexOf(trackInfo.trackId);
            bot.reply(message, 'Moving your song to the top of the queue.');
            reorderPlaylist(trackInfo, trackPosition, currentTrackPosition);
          } else {
            bot.reply(message, 'Good News! I was able to successfully add your track to the playlist!');
            bot.say(responses.addedToPlaylist(channelId, userName, trackInfo));
            addTrack(trackInfo, currentTrackPosition);
          }
        });
      });
  };

  spotifyApi.getTrack(trackId).then(function(response) {
    var trackInfo = createTrackObject(response.body);
    getRealNameFromId(bot, message.user).then(function(userName) {
      bot.startConversation(message, function(err, convo) {
        convo.say(responses.tryingToAdd(trackInfo));
        convo.ask(responses.proceed(), [{
          default: true,
          callback: function(response, convo) {
            convo.say('Sry, I didn\'t understand that. Pls try again');
            convo.next();
          }
        }, {
          pattern: bot.utterances.no,
          callback: function(response, convo) {
            convo.say('maybe you\'ll work up the courage one day.');
            convo.next();
          }
        }, {
          pattern: bot.utterances.yes,
          callback: function(response, convo) {
            updatePlaylist(trackInfo, userName);
            convo.next();
          }
        }]);
      });
    });
  }, function(err) {
    bot.reply(message, 'Looks like this error just happened: `' + err.message + '`');
  });
});

controller.hears(['what\'?s next', 'up next', 'next up'], 'direct_message,direct_mention', function(bot, message) {
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
          });
          nextThreeTracks.push({
            name: playlist[nextIndex].track.name,
            artist: artists.join(', ')
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
  bot.reply(message, "Hello.");
});

init();
