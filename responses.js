// italic
var i = function(value) {
  return '_' + value + '_';
};

// bold
var b = function(value) {
  return '*' + value + '*';
};

// code
var c = function(value) {
  return '`' + value + '`';
};

module.exports = {
  tryingToAdd: function(trackInfo) {
    return 'Looks like you\'re trying to add: ' + trackInfo.formattedTrackTitle;
  },
  addedToPlaylist: function(channelId, userName, trackInfo) {
    return {
      channel: channelId,
      text: b(userName) + ' just added a song to the playlist',
      attachments: [{
        fallback: trackInfo.formattedTrackTitle,
        text: trackInfo.formattedTrackTitle,
        color: '#23CF5F',
        mrkdwn_in: ['fallback', 'text'],
        thumb_url: trackInfo.artworkUrls.small
      }]
    };
  },
  help: function() {
    var canSay = b('up next') + " - " + i('I\'ll tell you what the next three tracks are') + '\n' +
                 b('info') + " - " + i('I\'ll tell you about this track') + '\n' +
                 b('detail') + " - " + i('I\'ll tell you more about this track');
    var search = 'If you\'d like to search for a track to add to the queue, direct message me the following:' + '\n\n' +
                 '\t\t' + c('search [search query]') + ' ' +  i('(without the square brackets)') + '\n\n' +
                 'and I\'ll show you the top 3 results from Spotify and let you decide if you\'d like to add one of the tracks by entering the ' + b('number') + ' of the song you\'d like to add.';
    var add = 'If you\'d like to add a track to the queue, direct message me the following:' + '\n\n' +
              '\t\t' + c('add [Spotify URI]') + ' ' + i('(again, without the square brackes)') + '\n\n' +
              'where ' + c('[Spotify URI]') + 'can be one of the following:' + '\n\n' +
              '\t\t• a Spotify URI - e.g. Spotify:track:' + b('[track id]') + '\n' +
              '\t\t• a Spotify song link - e.g. https://open.Spotifycom/track/ ' + b('[track id]') + '\n\n' +
              b('PROTIP:') + ' right click on a track in Spotify to copy either a song URI or link';
    var notes = b('NOTE:') + ' I\'m pretty stupid so if you tell me something and nothing happens, just try repeating yourself or saying "no" or "nvm" and starting over.';
    return {
      attachments: [{
        title: 'You can say these things to me:',
        fallback: canSay,
        text: canSay,
        color: '#23CF5F',
        mrkdwn_in: ['fallback', 'text']
      }, {
        title: 'Searching Tracks:',
        fallback: search,
        text: search,
        color: '#23CF5F',
        mrkdwn_in: ['fallback', 'text']
      }, {
        title: 'Adding Tracks:',
        fallback: add,
        text: add,
        color: '#23CF5F',
        mrkdwn_in: ['fallback', 'text']
      }, {
        fallback: notes,
        text: notes,
        color: 'danger',
        mrkdwn_in: ['fallback', 'text']
      }]
    };
  },
  detail: function(trackInfo) {
    console.log(trackInfo);
    return {
      attachments: [{
        fallback: trackInfo.formattedTrackTitle + ' from the album - ' + b(trackInfo.album),
        text: trackInfo.formattedTrackTitle + ' from the album - ' + b(trackInfo.album),
        color: '#23CF5F',
        mrkdwn_in: ['fallback', 'text'],
        thumb_url: trackInfo.artworkUrls.small
      }]
    };
  },
  info: function(track) {
    return 'This is ' + i(track.name) + ' by ' + b(track.artist);
  },
  upNext: function(nextTracks) {
    var responseString = '';
    nextTracks.forEach(function(track, index) {
      responseString += index + 1 + '. ' + i(track.name) + ' by ' + b(track.artist) + '\n';
    });
    return {
      attachments: [{
        fallback: responseString,
        text: responseString,
        color: '#23CF5F',
        mrkdwn_in: ['fallback', 'text']
      }]
    };
  },
  proceed: function() {
    return {
      text: 'Would you like to proceed?',
      attachments: [{
        fallback: b('YES') + ' to confirm',
        text: b('YES') + ' to confirm',
        color: 'good',
        mrkdwn_in: ['fallback', 'text']
      }, {
        fallback: b('NO') + ' to abort',
        text: b('NO') + ' to abort',
        color: 'danger',
        mrkdwn_in: ['fallback', 'text']
      }]
    };
  },
  searchResults: function(searchResults) {
    var resultsAttachments = searchResults.map(function(result, index) {
      return {
        title: index + 1 + '.',
        thumb_url: result.artworkUrls.small,
        fallback: result.formattedTrackTitle,
        text: result.formattedTrackTitle,
        color: '#23CF5F',
        mrkdwn_in: ['fallback', 'text']
      };
    });
    return {
      text: 'Enter the *number* of the song you\'d like to add or type *no* or *nvm* to continue without adding anything',
      attachments: resultsAttachments
    };
  }
};
