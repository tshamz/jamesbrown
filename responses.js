var italicize = function(value) {
  return '_' + value + '_';
};

var bold = function(value) {
  return '*' + value + '*';
};

var code = function(value) {
  return '`' + value + '`';
};

module.exports = {
  says: {
    trying: function(trackInfo) {
      return 'Looks like you\'re trying to add: ' + trackInfo.formattedSongTitle;
    },
    added: function(channelId, userName, trackInfo) {
      return {
        channel: channelId,
        text: '*'+ userName +'* just added a song to the playlist',
        attachments: [{
          fallback: trackInfo.formattedSongTitle,
          text: trackInfo.formattedSongTitle,
          color: '#23CF5F',
          mrkdwn_in: ['fallback', 'text'],
          image_url: trackInfo.artworkUrls.small
        }]
      };
    }
  },
  replies: {
    help: function() {
      return 'You can say these things to me:\n\n' +
             bold('up next') + " - " + italicize('I\'ll tell you what the next three tracks are') + '\n' +
             bold('info') + " - " + italicize('I\'ll tell you about this track') + '\n' +
             bold('detail') + " - " + italicize('I\'ll tell you more about this track') + '\n\n\n' +
             'If you\'d like to search for a track to add to the queue, direct message me the following:' + '\n\n' +
             '\t\t' + code('search [search query]') + ' ' +  italicize('(without the square brackets)') + '\n\n' +
             'and I\'ll show you the top 3 results from Spotify and let you decide if you\'d like to add one of the tracks by entering the ' + bold('number') + ' of the song you\'d like to add.' + '\n\n\n' +
             'If you\'d like to add a track to the queue, direct message me the following:' + '\n\n' +
             '\t\t' + code('add [Spotify URI]') + ' ' + italicize('(again, without the square brackes)') + '\n\n' +
             'where ' + code('[Spotify URI]') + 'can be one of the following:' + '\n\n' +
             '\t\t• a Spotify URI - e.g. Spotify:track:' + bold('[track id]') + '\n' +
             '\t\t• a Spotify song link - e.g. https://open.Spotifycom/track/ ' + bold('[track id]') + '\n\n' +
             bold('NOTE:') + ' I\'m pretty stupid so if you tell me something and nothing happens, just try repeating yourself or saying "no" or "nvm" and starting over.' + '\n\n' +
             bold('PROTIP:') + ' right click on a track in Spotify to copy either a song URI or link';
    },
    detail: function(track, artworkUrl) {
      return italicize(track.name) + ' by ' + bold(track.artist) + ' and is from the album - ' + bold(track.album) + '\n' + artworkUrl;
    },
    info: function(track) {
      return 'This is ' + italicize(track.name) + ' by ' + bold(track.artist);
    },
    next: function(state, playlist, playlistOrder) {
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
        responseString = responseString + i + '. ' + italicize(playlist[nextIndex].track.name) + ' by ' + bold(artists.join(', ')) + '\n';
      }
      return responseString;
    }
  },
  asks: {
    questions: {
      proceed: function() {
        return {
          text: 'Would you like to proceed?',
          attachments: [{
            fallback: bold('YES') + ' to confirm',
            text: bold('YES') + ' to confirm',
            color: 'good',
            mrkdwn_in: ['fallback', 'text']
          }, {
            fallback: bold('NO') + ' to abort',
            text: bold('NO') + ' to abort',
            color: 'danger',
            mrkdwn_in: ['fallback', 'text']
          }]
        };
      }
    },
    answers: {
      default: function() {
        return {
          default: true,
          callback: function(response, convo) {
            convo.say('Sry, I didn\'t understand that.');
            convo.repeat();
            convo.next();
          }
        };
      },
      no: function(bot) {
        return {
          pattern: bot.utterances.no,
          callback: function(response, convo) {
            convo.say('maybe you\'ll work up the courage one day.');
            convo.next();
          }
        };
      },
      yes: function(bot, message, updatePlaylist, trackInfo, userName) {
        return {
          pattern: bot.utterances.yes,
          callback: function(response, convo) {
            updatePlaylist(bot, message, convo, trackInfo, userName);
            convo.next();
          }
        };
      }
    }
  }
};
