bot.reply(message, {
    "attachments": [{
      "pretext": "*It looks like you're trying to add:*",
      "fallback": "It looks like you're trying to add a track",
      "callback_id": "add_this_track",
      "color": "#23CF5F",
      "thumb_url": trackInfo.artworkUrls.medium,
      "attachment_type": "default",
      "footer": "is this correct?",
      "mrkdwn_in": ['fallback', 'text', 'pretext'],
      "fields": [{
        "title": "Song",
        "value": trackInfo.name,
        "short": true
      }, {
        "title": "Artist",
        "value": trackInfo.artist,
        "short": true
      }],
      "actions": [{
        "name": "yes",
        "text": "Yes",
        "type": "button",
        "style": "primary",
        "value": "yes"
      }, {
        "name": "no",
        "text": "Nope",
        "type": "button",
        "value": "no"
      }]
    }]
});
