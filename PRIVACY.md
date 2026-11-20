# Privacy — CyberFeeds

CyberFeeds runs on your PC and keeps your data on your PC. It has **no account, no telemetry, no analytics SDK and no ads**. It never sends your feed subscriptions, articles or reading state to its author or to anyone else.

Everything it knows (feed subscriptions, articles or reading state) stays in `%APPDATA%\cybersfeeds.db`, the `logs\` folder and `backups\` (or the backup folder you choose). The installer keeps app data (`deleteAppDataOnUninstall: false`). Remove those folders manually if you want them gone.

## When CyberFeeds goes online

These are all the connections CyberFeeds makes by itself. None of them sends your feed subscriptions, articles or reading state. Like any request on the internet, the server sees your IP address.

| When | Where | What for | How to turn it off |
|---|---|---|---|
| On startup and on the polling schedule | the feed URLs you subscribed to | Fetch new articles and their content | `pollingEnabled`; each feed can also be disabled individually |
| On startup, for feeds without an icon | `www.google.com/s2/favicons` | Fetch the feed icon | No dedicated setting found |
| When full-content extraction is enabled | the article website and `www.youtube.com/oembed` | Show the full article or video preview | `autoFetchFullContent` (on by default) |
| 8 seconds after launch | GitHub Releases, with release notes from `api.github.com` | Check for a newer version | `autoUpdate` |

Translation uses `clients5.google.com` with `api.mymemory.translated.net` as fallback. Web searches and YouTube playback open external sites. All of them happen only when you start them.

## What CyberFeeds reads on your PC

CyberFeeds reads only its own local database and the feeds you chose; no usage data is collected. That information stays on your screen. Anything that changes the system asks for confirmation first and, where possible, is backed up so it can be undone.

## Questions

Open an issue: https://github.com/CyberGems/CyberFeeds/issues

For a privacy-specific question, use the [contact page](https://cybergems.org/contact). The suite-wide statement is at [cybergems.org/privacy](https://cybergems.org/privacy).
