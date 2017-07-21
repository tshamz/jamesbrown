#jamesbrown.js

<p align="center">
  <img width="100%" src="http://www-tc.pbs.org/wnet/americanmasters/files/2008/10/610_jamesbrown_soulsurvivor.jpg" />
</p>

>jamesbrown is a slackbot who can search and add songs to a specific Spotify playlist of your choosing, all from the comfort of your team's slack instance. We use him to facilitate selecting songs for playing music in our office.

## Getting Started

### Prerequisities

Unfortunately, the bot isn't plug and play, so you'll need to make sure you have the following items prepared before getting started:

1. A designated computer to host the bot and play music from using the Spotify desktop application. **NOTE:** because the bot uses the spotify-node-applescript package, this machine probably needs to be a Mac. I haven't tested on anything other than OS X, so I have no idea if this is actually the case.

2. A Spotify account with at least one playlist that the bot can add tracks to. You'll also need your username and the id of the playlist. You can find your username in your "Account overview" section while logged in [here](https://www.spotify.com/us/account/overview) and you can find a playlist's id by right clicking on the playlist and then selecting "Copy Playlist Link"/"Copy Spotify URI"/"Copy Spotify url" (the wording depends on whether you're using the web player or desktop app). Paste what you just copied somewhere and the id will be everything to the right of the last slash or colon (again, depending on where you copied the link from).

3. A Spotify app, which will create a client id and secret that we'll use later. The Spotify app can be created [here](https://developer.spotify.com/my-applications). If you haven't been done this already, you'll be prompted to link up your Spotify account as a developer account. Nothing too out of the ordinary.

4. A slack app, which will also create a client id and secret that we'll be using later on. The slack app can be created [here](https://api.slack.com/apps).

5. An [ngrok](https://ngrok.com) account and auth token that we'll use to expose compatible webhook urls for our locally hosted bot. A note on ngrok, you can use the free plan if you'd like, but because the free plan doesn't include reserved custom subdomains, the webhook urls created via ngrok will be constantly changing every time the bot is restarted. What that means is when you start the bot, you'll also need to go into the slack app's admin and update your app's urls. I would suggest paying for ngrok's basic plan and using custom subdomains, which frees you from having to constantly update your slack app's url. Read more below.

### Installing

After cloning the repo, you'll want to create a config file with all the information from above your Spotify and slack apps and accounts above. Create a file called `bot-setup.js` that looks like this:

```js
module.exports = {
  server: {
    port: 3000,
    subdomain: null,
    ngrokToken: '7Wmb6...' // NGROK AUTH TOKEN
  },
  slack: {
    clientId: '22312...',  // SLACK APP CLIENT ID
    clientSecret: 'c5181...',  // SLACK APP CLIENT SECRET
    channel: 'studio-54',  // SLACK REPORTIG CHANNEL NAME
  },
  spotify: {
    userName: 'fizzbuzz',  // SPOTIFY USERNAME
    playlistId: '14KDK...',  // DESIGNATED SPOTIFY PLAYLIST ID
    clientId: '8047e...',  // SPOTIFY APP CLIENT ID
    clientSecret: '1683f...',  // SPOTIFY APP CLIENT SECRET
    redirectUri: 'http://dev.tylershambora.com/spotify-callback'
  }
};
```

NOTE: If you're using ngrok's free option, leave the subdomain property above as null. If you paid for the basic plan and are using a custom subdomain, enter the domain here (not including ".ngrok.io").

Read more about the channel property and what it does in the "Reporting" section below...

### Reporting

If you'd like the bot to post a message in a specific channel detailing who just added what song to the playlist, add the name of that channel to the  `bot-setup.js` config file. If you don't want the bot to report anything, leave the channel property `bot-setup.js`as an empty string.

An idea for how to handle reporting is to create a dedicated public channel solely for reporting that the bot posts to. The channel would then serve as a historical record of every song added and if someone wanted to know the name of a song that played or which co-workers they need to make fun of for having horrible taste, they could join reporting channel, find the information they were looking for, and then leave the channel.

### Redirect URIs

Both the Spotify and slack apps require you to define a callback URIs when first setting up the apps. In the case of the Spotify app, because we're going to be copying and then manually using the auth code passed to the callback URI, you can use any url you'd like and then just copy the access code from the end of the url after being redirected to it. (I've provided a url hosted on my dev server that has simple instructions on what steps to take next, but you're welcome to use your own url instead). For the slack app, we're going to use the local server that's spun up by Botkit to run through the auth flow. The url that that should be used for the slack app oauth redirect url is `http://localhost:3000/oauth`.

### Bot Users & Interactive Messages

You'll also need to add a bot user for the slack app as well as enabling Interactive Messages. Interactive Messages require your to enter a request url, which we're going to leverage ngrok for again. The request URL should look like this: `https://[YOUR SUBDOMAIN].ngrok.io/slack/receive`.

## Running the Bot

If you've just cloned the repository, you'll need to install project dependencies by running:

```sh
npm install
```

then, in order to start up the bot, from the project's root directory run:

```sh
node jamesbrown.js
```

If this is your first time starting up the bot, you'll also need to make sure that you authorize your bot by visiting `http://localhost:3000/login` and following the steps there. Assuming the authorization is successful, that whole flow should end with you being directed to whatever URL was entered as the Spotify redirectUri property in `bot-setup.js`, along with a code attached to the end of the URL as a query string. You're gonna need to copy that code out of the URL and take it back to the terminal, where you should see a prompt to paste in the code you just copied.

## Commands

**REMEMBER:** If you forget any of these commands or how they need to be entered, you can always send a direct message to the bot asking for help (e.g. "*help me*", "*i need help*", or "*help!*", etc.) and he'll give you a list of of everything you can say, along with a brief description of each command.

##### Basic Commands:

You can direct message the bot any of the following commands:

- `up next` - The bot will tell you what the next three tracks are
- `info` - The bot will tell you information about this track
- `detail` - The bot will tell you more information about this track

##### Adding Music:

If you'd like to add a track to the playlist, direct message the bot:

`add [Spotify URI]` *(without the square brackets)*

where `[Spotify URI]` can be one of the following:

- a Spotify URI - e.g. `Spotify:track:[track id]`
- a Spotify song link - e.g. `https://open.spotifycom/[track id]`

##### Searching Music:

If you'd like to search for a track to add, direct message the bot:

`search [search query]` _(again, without the square brackets)_

and the bot will show you the top 3 search results from Spotify. You'll then be able to either add one of the results or start over and search again.

## Built With

* [Botkit](https://github.com/howdyai/botkit)
* [slack api](https://api.slack.com/)
* [Spotify api](https://developer.spotify.com/web-api/endpoint-reference)
* [Spotify node web api](https://github.com/thelinmichael/spotify-web-api-node)
* [Spotify node applescript](https://github.com/andrehaveman/spotify-node-applescript)

## Authors

* **Tyler Shambora** - [tshamz](https://github.com/tshamz)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## Acknowledgments

- [example app](https://joshmcarthur.com/2012/08/12/building-on-the-spot-a-spotify-play-queue.html)
- [spotify slackbot](https://github.com/markstickley/spotifyslackbot)
