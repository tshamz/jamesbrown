# Mr. Dynamite

Mr. Dynamite is a Slackbot who can search and add songs to a designated Spotify playlist all from within the comfort of your team's Slack instance. It is a great way to facilitate the playing of music throughout the office.

![Robot James Brown](https://i.ytimg.com/vi/2b-_tV953PM/maxresdefault.jpg)

## Getting Started

You will need to make sure you have the following items prepared before getting started:

1. Designated computer for playing music from
2. Spotify account w/ designated playlist (you'll need your username and the playlist id)
3. Spotify app with a client id and client secret
4. Slack app with client id and client
5. Slack channel for the bot to report into (optional)

### Prerequisities

You'll need to have localtunnel installed globally on your machine (which itself requires node and npm to be installed). Install it by running

```sh
npm install -g localtunnel
```

### Installing

After cloning the repo, you'll want to create a config file with all the information from your Spotify and Slack apps and accounts above. Create a file called `bot-setup.js` that looks like this:

```js
module.exports = {
  server: {
    port: 3000
  },
  slack: {
    clientId: '[SLACK APP CLIENT ID]',
    clientSecret: '[SLACK APP CLIENT SECRET]',
    channel: '[SLACK REPORTIG CHANNEL NAME]',
  },
  spotify: {
    userName: '[SPOTIFY USERNAME]',
    playlistId: '[DESIGNATED SPOTIFY PLAYLIST ID]',
    clientId: '[SPOTIFY APP CLIENT ID]',
    clientSecret: '[SPOTIFY APP CLIENT SECRET]',
    redirectUri: 'http://dev.tylershambora.com/spotify-callback'
  }
};
```

### Redirect URIs

Both apps require you to define callback URIs when first setting up the apps. In the case of the Spotify app, because we're going to be copying and then manually using the auth code passed to the callback URI, you can use any publicly accessible location (I've provided a URL hosted on my dev server, but if you don't trust me you're more than welcome to use your own). For the Slack app, we're going to use the local server that's spun up by Botkit to run through the auth flow. The URI that that should be used for the slack app is http://localhost:3000/oauth.

### Bot Users & Interactive Messages

You'll also want to add a bot user for the Slack app (I named mine @jamesbrown, naturally), as well as enabling Interactive Messages. Because Interactive Messages require that your request URL use the https protocol, but our server and subsequent request URL at /slack/receive are running locally, we're going to leverage localtunnel to make sure everything runs smoothly. After starting your bot and the local server that botkit creates for you, run the following command in your terminal:

```sh
lt --port 3000 --subdomain [unique identifier]
```

where [unique identifier] is a subdomain to identify your app by. You'll then enter https://[unique identifier].localtunnel.me/slack/receive as the request URL for your app's Interactive Messages.

## Deployment

While in the project directory, run:

```sh
node mr-dynamite.js
```

and in another terminal window, run:

```sh
lt --port 3000 --subdomain [unique identifier]
```

## Built With

* [Botkit](https://github.com/howdyai/botkit)


## Authors

* **Tyler Shambora** - [tshamz](https://github.com/tshamz)

See also the list of [contributors](https://github.com/BVAccel/Mr-Dynamite/contributors) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Acknowledgments

- botkit: https://github.com/howdyai/botkit
- spotify api: https://developer.spotify.com/web-api/endpoint-reference/
- spotify slackbot: https://github.com/markstickley/spotifyslackbot/
- spotify node-applescript: https://github.com/andrehaveman/spotify-node-applescript
- example app: https://joshmcarthur.com/2012/08/12/building-on-the-spot-a-spotify-play-queue.html
