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
  addedToPlaylist: function(channelId, userName, trackInfo) {
    return {
      channel: channelId,
      text: b(userName) + ' just added a song to the playlist.',
      mrkdwn_in: ['text'],
      attachments: [{
        fallback: trackInfo.formattedTrackTitle + ' from the album - ' + b(trackInfo.album),
        text: 'Title: ' + i(trackInfo.name) + '\nArtist: ' + b(trackInfo.artist) + '\nAlbum: ' + b(trackInfo.album),
        color: '#23CF5F',
        thumb_url: trackInfo.artworkUrls.small,
        mrkdwn_in: ['text']
      }]
    };
  },
  help: function() {
    var canSay = b('up next') + ' - ' + i('I\'ll tell you what the next three tracks are') + '\n' +
                 b('info') + ' - ' + i('I\'ll tell you about this track') + '\n' +
                 b('detail') + ' - ' + i('I\'ll tell you more about this track');
    var add = 'If you\'d like to add a track to the queue, direct message me:' + '\n\n' +
              '\t' + c('add [Spotify URI]') + ' ' + i('(without the square brackes)') + '\n\n' +
              'where ' + c('[Spotify URI]') + 'can be one of the following:' + '\n\n' +
              '\t• a Spotify URI - e.g. Spotify:track:' + b('[track id]') + '\n' +
              '\t• a Spotify song link - e.g. https://open.Spotifycom/ ' + b('[track id]');
    var search = 'If you\'d like to search for a track to add, direct message:' + '\n\n' +
                 '\t' + c('search [search query]') + ' ' +  i('(again, without the square brackets)') + '\n\n' +
                 'and I\'ll show you the top 3 results from Spotify. You\'ll then be able to either add one of the results or start over and search again.';
    var protip = b('PROTIP:') + ' right click on a track in Spotify to copy either a song URI or link';
    return {
      attachments: [{
        title: 'Commands',
        fallback: canSay,
        text: canSay,
        mrkdwn_in: ['text']
      }, {
        title: 'Adding Music:',
        fallback: add,
        text: add,
        'footer': protip,
        mrkdwn_in: ['text', 'footer']
      }, {
        title: 'Searching Music:',
        fallback: search,
        text: search,
        mrkdwn_in: ['text']
      }]
    };
  },
  detail: function(trackInfo) {
    return {
      attachments: [{
        fallback: '${trackInfo.formattedTrackTitle} from the album - *${trackInfo.album}*',
        text: 'Title: _${trackInfo.name}_\nArtist: *${trackInfo.artist}*\nAlbum: *${trackInfo.album}*\nSpotify ID: ${trackInfo.trackId}',
        color: '#23CF5F',
        thumb_url: trackInfo.artworkUrls.small,
        mrkdwn_in: ['text']
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
        mrkdwn_in: ['text']
      }]
    };
  },
  proceed: function(trackInfo) {
    var yesText = ['Absolutely', 'yessss!', 'Duuuuuh', 'Of Course', ':+1::skin-tone-3:', ':ok_hand::skin-tone-3:'];
    var noText = ['No', 'Nope', 'Negative', ':thumbsdown::skin-tone-3:', ':poop:'];
    var randomYesText = yesText[Math.floor(Math.random() * yesText.length)];
    var randomNoText = noText[Math.floor(Math.random() * noText.length)];
    var stringifiedTrackInfo = JSON.stringify(trackInfo);
    return {
      replace_original: true,
      attachments: [{
        fallback: trackInfo.formattedTrackTitle,
        callback_id: 'add_this_track',
        pretext: b('It looks like you\'re trying to add:'),
        color: '#23CF5F',
        thumb_url: trackInfo.artworkUrls.medium,
        attachment_type: 'default',
        footer: 'is this correct?',
        mrkdwn_in: ['pretext'],
        fields: [{
          title: 'Song',
          value: trackInfo.name,
          short: true
        }, {
          title: 'Artist',
          value: trackInfo.artist,
          short: true
        }, {
          title: 'Album',
          value: trackInfo.album,
          short: true
        }, {
          title: 'Spotify ID',
          value: trackInfo.trackId,
          short: true
        }],
        actions: [{
          name: 'yes',
          text: randomYesText,
          value: stringifiedTrackInfo,
          type: 'button',
          style: 'primary'
        }, {
          name: 'no',
          text: randomNoText,
          value: 'no',
          type: 'button',
          style: 'danger'
        }]
      }]
    };
  },
  searchResults: function(searchResults) {
    var resultsActions = searchResults.map(function(result, index) {
      return {
        name: index + 1,
        text: index + 1,
        value: JSON.stringify(searchResults[index]),
        type: 'button'
      };
    });
    var nvmAction = {
      name: 'nvm',
      text: 'nvm',
      value: 'nvm',
      type: 'button',
      style: 'danger'
    };
    var resultsAttachments = searchResults.map(function(result, index) {
      return {
        title: index + 1 + '.',
        thumb_url: result.artworkUrls.medium,
        color: '#23CF5F',
        fields: [{
          title: 'Song',
          value: result.name,
          short: true
        }, {
          title: 'Artist',
          value: result.artist,
          short: true
        }, {
          title: 'Album',
          value: result.album,
          short: true
        }, {
          title: 'Spotify ID',
          value: result.trackId,
          short: true
        }]
      };
    });
    var actionAttachment = {
      footer: 'make a selection:',
      fallback: 'Interactive Messages Not Supported',
      callback_id: 'select_a_track',
      attachment_type: 'default',
      actions: resultsActions
    };
    resultsActions.push(nvmAction);
    resultsAttachments.push(actionAttachment);
    return {
      replace_original: true,
      attachments: resultsAttachments
    };
  }
};
