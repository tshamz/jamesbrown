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

You'll need to have localtunnel installed globally on your machine (which itself requires node and npm to be installed to do this). Install it by running

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

A step by step series of examples that tell you have to get a development env running

Stay what the step will be

```
Give the example
```

And repeat

```
until finished
```

End with an example of getting some data out of the system or using it for a little demo

## Running the tests

Explain how to run the automated tests for this system

### Break down into end to end tests

Explain what these tests test and why

```
Give an example
```

### And coding style tests

Explain what these tests test and why

```
Give an example
```

## Deployment

Add additional notes about how to deploy this on a live system

## Built With

* Dropwizard - Bla bla bla
* Maven - Maybe
* Atom - ergaerga

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/your/project/tags).

## Authors

* **Billie Thompson** - *Initial work* - [PurpleBooth](https://github.com/PurpleBooth)

See also the list of [contributors](https://github.com/your/project/contributors) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Acknowledgments

* Hat tip to anyone who's code was used
* Inspiration
* etc
## The Hardest Working Man in Show Business

- botkit: https://github.com/howdyai/botkit
- spotify api: https://developer.spotify.com/web-api/endpoint-reference/
- spotify slackbot: https://github.com/markstickley/spotifyslackbot/
- spotify node-applescript: https://github.com/andrehaveman/spotify-node-applescript
- example app: https://joshmcarthur.com/2012/08/12/building-on-the-spot-a-spotify-play-queue.html
