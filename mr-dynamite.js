var setup            = require('./bot_setup.js');

var Botkit           = require('botkit');
var request          = require('request');
var SpotifyWebApi    = require('spotify-web-api-node');
var Spotify          = require('spotify-node-applescript');

var q                = require('q');
var os               = require('os');
var https            = require('https');

var lastTrackId;
var channelId;

var lastAdded = '';

var clientId = setup.spotifyClientId;
var clientSecret = setup.spotifyClientSecret;
var redirectUri = 'http://dev.tylershambora.com/music';
var scopes = ['playlist-read-private', 'playlist-modify', 'playlist-modify-private'];
var playlistId = '14KDKEQGjVcdTzJrswI6Zm';

var controller = Botkit.slackbot({
    debug: false,
});

var bot = controller.spawn({
    token: setup.token
}).startRTM();

var spotifyApi = new SpotifyWebApi({
  redirectUri: redirectUri,
  clientId: clientId,
  clientSecret: clientSecret,
  accessToken: setup.accessToken,
  refreshToken: setup.refreshToken
});


// Authentication ===============================================

// When our access token will expire
var tokenExpirationEpoch;

// First retrieve an access token
var authorizationCode = 'AQC0A2qZAriiIrdnnDF9HObw_rS3K7E1Qjk9MiiHy6RY9J7O0Be9Kwn7btPlgXaw2KIzPb_YmXCw_0Y_qqaEV0pka8vmw4K6ohkyhHoIM0pnTughXaP96TMsIeNKmrzGZD8aQnor0gKhfDRzccWaZuCKFas_JPdlEqu4f3fvEHumNOcINTlOuKX3KdgCiCFbs7NKPv-8gkt_6gxA0lxyENuGDV0PCECAoDDx36i_E37Ucjuk8OeHk5WFiTYsvAJD8R6AfxFgZsyjtFg9_3tuRxm0A7omKl8Ijeg_0NgtRKZbspYM-ZXxXnS5FV4T43e1s2DXSozj8ubf0nUG_A';

spotifyApi.authorizationCodeGrant(authorizationCode).then(function(data) {
  // Set the access token and refresh token
  console.log('access token: ' + data.body['access_token']);
  console.log('refresh token: ' + data.body['refresh_token']);

  spotifyApi.setAccessToken(data.body['access_token']);
  spotifyApi.setRefreshToken(data.body['refresh_token']);

  // Save the amount of seconds until the access token expired
  tokenExpirationEpoch = (new Date().getTime() / 1000) + data.body['expires_in'];
  console.log('Retrieved token. It expires in ' + Math.floor(tokenExpirationEpoch - new Date().getTime() / 1000) + ' seconds!');
}, function(err) {
  console.log('Something went wrong when retrieving the access token!', err.message);
});

// or

spotifyApi.refreshAccessToken().then(function(data) {
  spotifyApi.setAccessToken(data.body['access_token']);
  tokenExpirationEpoch = (new Date().getTime() / 1000) + data.body['expires_in'];
  console.log('Retrieved token. It expires in ' + Math.floor(tokenExpirationEpoch - new Date().getTime() / 1000) + ' seconds!');
});


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
        lastTrackId = null
      }
    }
  });
}, 5000);

// Continually print out the time left until the token expires..
var numberOfTimesUpdated = 0;
setInterval(function() {
  numberOfTimesUpdated = numberOfTimesUpdated + 1;
  console.log('Time left: ' + Math.floor((tokenExpirationEpoch - new Date().getTime() / 1000)) + ' seconds left! (tick: '+ numberOfTimesUpdated +')');

  // OK, we need to refresh the token.
  if (numberOfTimesUpdated > 1500) {
    numberOfTimesUpdated = 0;

    // Refresh token and print the new time to expiration.
    spotifyApi.refreshAccessToken()
      .then(function(data) {
        console.log(data.body);
        spotifyApi.setAccessToken(data.body['access_token']);
        tokenExpirationEpoch = (new Date().getTime() / 1000) + data.body['expires_in'];
        console.log('Refreshed token. It now expires in ' + Math.floor(tokenExpirationEpoch - new Date().getTime() / 1000) + ' seconds!');
      }, function(err) {
        console.log('Could not refresh the token!', err.message);
      });
  }
}, 1000);


// Helper Functions ===============================================

var getRealNameFromId = function(bot, userId) {
  var deferred = q.defer();
  var realName = '';
  bot.api.users.info({user: userId}, function(err, response) {
    realName = response.user.real_name.toLowerCase();
    deferred.resolve(realName);
  });
  return deferred.promise;
};

var getArtworkUrlFromTrack = (track, callback) => {
  var trackId = track.id.split(':')[2];
  var reqUrl = 'https://api.spotify.com/v1/tracks/'+trackId;
  var req = https.request(reqUrl, function(response) {
    var str = '';
    response.on('data', function (chunk) {
      str += chunk;
    });
    response.on('end', function() {
      var json = JSON.parse(str);
      if (json && json.album && json.album.images && json.album.images[1]) {
        callback(json.album.images[1].url);
      }
      else {
        callback('');
      }
    });
  });
  req.end();
};

var verifyChannel = function(channel) {
  if(channel && channel.name && channel.id && setup.channel && channel.name == setup.channel) {
    channelId = channel.id;
    console.log('** ...chilling out on #' + channel.name);
    return true;
  }
  return false;
};

var logToConsole = function(userName, song, artists) {
  console.log('\n\n\n' + userName + ' just tried to add:\n      song: ' + song + '\n    artist: ' + artists.join(', ') + '\n\n\n');
};


// Responses  ===============================================



// Listeners  ===============================================

controller.hears([/search ([\s\S]+)/], 'direct_message', function(bot, message) {

  var searchQuery = message.match[1];
  var searchResults = [];

  spotifyApi.searchTracks(searchQuery)
    .then(function(data) {
      var results = data.body.tracks.items;

      if (results.length === 0) {
        bot.reply(message, 'Sorry, no results.');
        return false;
      }

      for (var i = 0; i < results.length; i++) {
        if (i >= 3) {
          break;
        }

        var artists = results[i].artists.map(function(artistObj) {
          return artistObj.name;
        });
        searchResults.push({
          title: results[i].name,
          artists: artists,
          album: results[i].album.name,
          artworkUrls: {
            medium: results[i].album.images[1].url,
            small: results[i].album.images[2].url
          },
          formattedSongTitle: '_' + results[i].name + '_ by *' + artists.join(', ') + '*',
          trackId: results[i].id
        });
      }

      var resultsAttachments = searchResults.map(function(result, index) {
        var str = '*track:* _' + result.title + '_\n*artist:* _' + result.artists.join(', ') + '_\n* album:* _' + result.album + '_';
        return {
          title: index + 1 + '.',
          image_url: result.artworkUrls.small,
          fallback: str,
          text: str,
          color: '#23CF5F',
          mrkdwn_in: ['fallback', 'text']
        };
      });

      var updatePlaylist = function(convo, trackInfo, userName) {
        spotifyApi.getPlaylist('tshamz', playlistId)
          .then(function(data) {
            var playlistOrder = data.body.tracks.items.map(function(item) {
              return item.track.id;
            });
            Spotify.getState(function(err, state) {
              var currentTrackId = state.track_id.substring(14);
              var currentTrackPosition = playlistOrder.indexOf(currentTrackId);
              if (playlistOrder.indexOf(trackInfo.trackId) !== -1) {
                bot.reply(message, 'Moving your song to the top of the queue.');
                spotifyApi.reorderTracksInPlaylist('tshamz', playlistId, playlistOrder.indexOf(trackInfo.trackId), currentTrackPosition + 1, {"range_length": 1})
                  .then(function(data) {
                    console.log('Tracks reordered in playlist!');
                    logToConsole(userName, trackInfo.title, trackInfo.artists);
                  });
              } else {
                spotifyApi.addTracksToPlaylist('tshamz', playlistId, 'spotify:track:' + trackInfo.trackId, {position: currentTrackPosition + 1})
                  .then(function(response) {
                    bot.reply(message, 'Good News! I was able to successfully add your track to the playlist!');
                    bot.say({
                      channel: channelId,
                      text: '*'+ userName +'* just added a song to the playlist\n' + trackInfo.artworkUrls.medium,
                      attachments: [{
                        fallback: trackInfo.formattedSongTitle,
                        text: trackInfo.formattedSongTitle,
                        color: '#23CF5F',
                        mrkdwn_in: ['fallback', 'text']
                      }]
                    });
                    logToConsole(userName, trackInfo.title, trackInfo.artists);
                  });
              }
            });
          });
      };

      var askIfSure = function(response, convo, trackInfo) {
        getRealNameFromId(bot, message.user)
          .then(function(userName) {
            bot.startConversation(message, function(err, convo) {
              convo.say('Looks like you\'re trying to add: ' + trackInfo.formattedSongTitle);
              convo.ask({
                text: 'Would you like to proceed?',
                attachments: [{
                  fallback: '*YES* to confirm',
                  text: '*YES* to confirm',
                  color: 'good',
                  mrkdwn_in: ['fallback', 'text']
                }, {
                  fallback: '*NO* to abort',
                  text: '*NO* to abort',
                  color: 'danger',
                  mrkdwn_in: ['fallback', 'text']
                }]
              }, [{
                default: true,
                callback: function(response, convo) {
                  convo.say('Sry, I didn\'t understand that.');
                  convo.repeat();
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
                  updatePlaylist(convo, trackInfo, userName);
                  convo.next();
                }
              }]);
            });
          });
      };

      var askChoice = function(response, convo) {
        convo.ask({
          text: 'Enter the *number* of the song you\'d like to add or type *no* to continue without adding anything',
          attachments: resultsAttachments
        }, [{
          default: true,
          callback: function(response, convo) {
            convo.repeat();
            convo.next();
          }
        }, {
          pattern: bot.utterances.no,
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

      bot.startConversation(message, askChoice);

    }, function(err) {
      bot.reply(message, 'Looks like this error just happened: `' + err.message + '`');
    });
});


controller.hears([/search ([\s\S]+)/], 'direct_message', function(bot, message) {
  var searchQuery = message.match[1];
  var albumArtUrl;


  spotifyApi.searchTracks(searchQuery)
    .then(function(data) {
      var results = data.body.tracks.items;

      if (results.length === 0) {
        bot.reply(message, 'Sorry, no results.');
        return false;
      }

      var searchResults = buildResultsObjects(results);
      var resultsAttachments = searchResults.map(function(result, index) {
        return {
          title: index + 1 + '.',
          image_url: result.albumArtSmall,
          text: '\n*track:* _' + result.track + '_\n' + '*artist:* _' + result.artist + '_\n' + '*album:* _' + result.album + '_\n\n',
          color: '#23CF5F',
          mrkdwn_in: ['fallback', 'text']
        };
      });

      var askChoice = function(response, convo) {
        convo.ask({
          text: 'Enter the *number* of the song you\'d like to add or type *nvm* to continue without adding anything',
          attachments: resultsAttachments
        }, [{
          default: true,
          callback: function(response, convo) {
            convo.say('Sry, I didn\'t understand that.');
            convo.repeat();
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

      var reorderTrack = function(convo, trackId, playlistOrder, currentTrackPosition) {
        spotifyApi.reorderTracksInPlaylist('tshamz', playlistId, playlistOrder.indexOf(trackId), currentTrackPosition + 1, {"range_length": 1})
          .then(function(data) {
            convo.next();
            console.log('Tracks reordered in playlist!');
          });
      };

      var addNewTrack = function(trackId, currentTrackPosition, username, formattedSongTitle) {
        spotifyApi.addTracksToPlaylist('tshamz', playlistId, 'spotify:track:' + trackId, {position: currentTrackPosition + 1})
          .then(function(response) {
            bot.reply(message, 'Good News! I was able to successfully add your track to the playlist!');
            bot.say({
              channel: channelId,
              text: '*'+ userName +'* just added a song to the playlist\n' + albumArtUrl,
              attachments: [{
                fallback: formattedSongTitle,
                text: formattedSongTitle,
                color: '#23CF5F',
                mrkdwn_in: ['fallback', 'text']
              }]
            });
            convo.next();
          });
      };

      var updatePlaylist = function(convo, trackId, userName, formattedSongTitle) {
        console.log('ding1');
        spotifyApi.getPlaylist('tshamz', playlistId)
          .then(function(data) {
            var currentTrack;
            var playlistOrder = data.body.tracks.items.map(function(item) {
              return item.track.id;
            });
            console.log(playlistOrder);
            Spotify.getState(function(err, state) {
              currentTrackId = state.track_id.substring(14);
              var currentTrackPosition = playlistOrder.indexOf(currentTrackId);
              if (playlistOrder.indexOf(trackId) !== -1) {
                bot.reply(message, 'Moving your song to the top of the queue.');
                reorderTracks(convo, trackId, playlistOrder. currentTrackPosition);
              } else {
                addNewTrack(convo, trackId, currentTrackPosition, userName, formattedSongTitle);
              }
            });
          });
      };

      var askIfSure = function(response, convo, result) {
        var trackId = result.id;
        var user = response.user
        albumArtUrl = result.albumArtMedium;


        spotifyApi.getTrack(trackId).then(function(response) {
          var title = response.body.name;
          var artists = response.body.artists.map(function(artistObj) {
            return artistObj.name;
          });
          var formattedSongTitle = '_' + title + '_ by *' + artists.join(', ') + '*';

          getRealNameFromId(bot, user)
            .then(function(userName) {
              convo.say('Looks like you\'re trying to add: ' + formattedSongTitle);
              convo.ask(yesno, [{
                default: true,
                callback: function(response, convo) {
                  convo.say('Sry, I didn\'t understand that. pls say yes or no.');
                  convo.repeat();
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
                  updatePlaylist(convo, trackId, userName, formattedSongTitle);
                  logToConsole(userName, result.track, result.artistArray);
                }
              }]);
            });
        });

      };

      bot.startConversation(message, askChoice);

    });
});



controller.hears([/add .*track[:\/](\d\w*)/], 'direct_message', function(bot, message) {

  var updatePlaylist = function(convo, trackInfo, userName) {
    spotifyApi.getPlaylist('tshamz', playlistId)
      .then(function(data) {
        var playlistOrder = data.body.tracks.items.map(function(item) {
          return item.track.id;
        });
        Spotify.getState(function(err, state) {
          var currentTrackId = state.track_id.substring(14);
          var currentTrackPosition = playlistOrder.indexOf(currentTrackId);
          if (playlistOrder.indexOf(trackInfo.trackId) !== -1) {
            bot.reply(message, 'Moving your song to the top of the queue.');
            spotifyApi.reorderTracksInPlaylist('tshamz', playlistId, playlistOrder.indexOf(trackInfo.trackId), currentTrackPosition + 1, {"range_length": 1})
              .then(function(data) {
                console.log('Tracks reordered in playlist!');
                logToConsole(userName, trackInfo.title, trackInfo.artists);
              });
          } else {
            spotifyApi.addTracksToPlaylist('tshamz', playlistId, 'spotify:track:' + trackInfo.trackId, {position: currentTrackPosition + 1})
              .then(function(response) {
                bot.reply(message, 'Good News! I was able to successfully add your track to the playlist!');
                bot.say({
                  channel: channelId,
                  text: '*'+ userName +'* just added a song to the playlist\n' + trackInfo.artworkUrls.medium,
                  attachments: [{
                    fallback: trackInfo.formattedSongTitle,
                    text: trackInfo.formattedSongTitle,
                    color: '#23CF5F',
                    mrkdwn_in: ['fallback', 'text']
                  }]
                });
                logToConsole(userName, trackInfo.title, trackInfo.artists);
              });
          }
        });
      });
  };

  var trackId = message.match[1];
  if (trackId.indexOf('spotify:track:') !== -1) {
    trackId = trackId.slice(15, -1);
  } else if (trackId.indexOf('https://open.spotify.com/track/') !== -1) {
    trackId = trackId.slice(32, -1);
  }

  spotifyApi.getTrack(trackId).then(function(response) {
    var artists = response.body.artists.map(function(artistObj) {
      return artistObj.name;
    });
    var trackInfo = {
      title: response.body.name,
      artists: artists,
      album: response.body.album.name,
      artworkUrls: {
        medium: response.body.album.images[1].url,
        small: response.body.album.images[2].url
      },
      formattedSongTitle: '_' + response.body.name + '_ by *' + artists.join(', ') + '*',
      trackId: trackId
    };

    getRealNameFromId(bot, message.user)
      .then(function(userName) {
        bot.startConversation(message, function(err, convo) {
          convo.say('Looks like you\'re trying to add: ' + trackInfo.formattedSongTitle);
          convo.ask({
            text: 'Would you like to proceed?',
            attachments: [{
              fallback: '*YES* to confirm',
              text: '*YES* to confirm',
              color: 'good',
              mrkdwn_in: ['fallback', 'text']
            }, {
              fallback: '*NO* to abort',
              text: '*NO* to abort',
              color: 'danger',
              mrkdwn_in: ['fallback', 'text']
            }]
          }, [{
            default: true,
            callback: function(response, convo) {
              convo.say('Sry, I didn\'t understand that.');
              convo.repeat();
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
              updatePlaylist(convo, trackInfo, userName);
              convo.next();
            }
          }]);
        });
      });
  }, function(err) {
    bot.reply(message, 'Looks like this error just happened: `' + err.message + '`');
  });
});

controller.hears(['whats next', 'what\'s next', 'up next', 'next up'], 'direct_message,direct_mention', function(bot, message) {
  spotifyApi.getPlaylist('tshamz', playlistId)
    .then(function(data) {
      var playlist = data.body.tracks.items;
      var playlistOrder = playlist.map(function(item) {
        return item.track.id;
      });
      Spotify.getState(function(err, state) {
        var currentTrackId = state.track_id.substring(14);
        var currentTrackPosition = playlistOrder.indexOf(currentTrackId);
        var playlistLength = playlistOrder.length - 1;
        var nextThreeIndexes = [];
        var responseString = '';
        for (var i = 1; i <= 3; i++) {
          var nextIndex = currentTrackPosition + i;
          if (nextIndex - playlistLength >= 0) {
            nextIndex = nextIndex - playlistLength;
          }
          var artists = playlist[nextIndex].track.artists.map(function(artistObj) {
            return artistObj.name;
          });
          responseString = responseString + i + '. _' + playlist[nextIndex].track.name + '_ by *' + artists.join(', ') + '*\n';
        }
        bot.reply(message, responseString);
      });
    });
});

controller.hears(['help'], 'direct_message', function(bot, message) {
  bot.reply(message, 'You can say these things to me:\n\n'+
    '*up next* - _I\'ll what tracks are coming up next_\n'+
    '*info* - _I\'ll tell you about this track_\n'+
    '*detail* - _I\'ll tell you more about this track_\n\n\n'+
    'If you\'d like to search for a track to add to the queue, direct message me the following:\n\n'+
    '      `search [search query]` _(without the square brackets)_\n\n'+
    'and I\'ll show you the top 3 results from Spotify and let you decide if you\'d like to add one of the tracks by entering the *number* of the song you\'d like to add\n\n\n'+
    'If you\'d like to add a track to the queue, direct message me the following:\n\n'+
    '      `add [Spotify URI]` _(again, without the square brackets)_\n\n'+
    'where `[Spotify URI]` can be one of the following:\n'+
    '    • a Spotify URI - e.g. Spotify:track:*[track id]*\n'+
    '    • a Spotify song link - e.g. https://open.Spotify.com/track/*[track id]*\n\n\n'+
    '*NOTE*: I\'m pretty stupid so if you tell me something and nothing happens, just try repeating yourself or saying "no" and starting over.\n\n'+
    '*PROTIP:* right click on a track in Spotify to copy either a song URI or link'
  );
});

controller.hears(['hello', 'hi'], 'direct_message,direct_mention,mention', function(bot, message) {
  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'radio',
  });
  bot.reply(message, "Hello.");
});

controller.hears(['info'], 'direct_message,direct_mention,mention', function(bot, message) {
  Spotify.getTrack(function(err, track){
    if (track) {
      lastTrackId = track.id;
      bot.reply(message, 'This is _' + track.name + '_ by *' + track.artist + '*!');
    }
  });
});

controller.hears(['detail'], 'direct_message,direct_mention,mention', function(bot, message) {
  Spotify.getTrack(function(err, track){
    if (track) {
      lastTrackId = track.id;
      getArtworkUrlFromTrack(track, function(artworkUrl) {
        bot.reply(message, '_' + track.name + '_ by *' + track.artist + '* is from the album - *' + track.album + '*\n' + artworkUrl);
      });
    }
  });
});

init();
