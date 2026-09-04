# WhatsApp Selfbot

A selfbot built with [whatsapp-web.js](https://wwebjs.dev/) — it runs on your own WhatsApp
account (as a linked device) and responds to commands you type to yourself or in any chat.

⚠️ **Heads up:** This uses an unofficial library that automates WhatsApp Web. It's against
WhatsApp's Terms of Service, and accounts doing this have been banned. Consider using a
secondary/burner number rather than your primary one.

## What changed in this update

- **Style overhaul** — dropped the ``` ``` ``` code-block look. Replies are now bold
  headers + a soft divider + emoji, which reads as a designed message instead of debug
  output.
- **Whitelist actually fixed** — WhatsApp IDs can come back with different domain suffixes
  depending on context (`@c.us`, `@lid`, `@s.whatsapp.net`). Comparing full ID strings
  meant a number you added could silently never match the sender ID the library handed
  back. Now everything's normalized to digits-only before comparing.
- **Purge fixed** — it was trusting the order `fetchMessages()` returns without guaranteeing
  it, which could grab the wrong messages. Now sorts explicitly by timestamp before picking
  "last N," and reports how many were skipped (too old to delete-for-everyone — a WhatsApp
  platform limit, not something the bot controls).
- **Prefix is now `$`** by default (`$ping`, `$help`, etc.) — change it in `.env`.
- **18 new commands** across every category (see table below). **43 total.**

## Features

Run `$help` for the category overview, `$help fun` for a category's commands, or
`$help snipe` for one command's usage.

| Category | Commands |
|---|---|
| Tracking | `snipe`, `editsnipe`, `clearsnipe` |
| General | `ping`, `help`, `uptime`, `botinfo`, `prefix` |
| Utility | `avatar`, `info`, `id`, `time`, `seen`, `typing` |
| Fun | `insult`, `rizz`, `roast`, `compliment`, `8ball`, `coinflip`, `dice`, `rate`, `ship`, `fact`, `joke`, `wyr`, `hug`, `riddle`, `truth`, `dare`, `slap` |
| Admin | `wl`, `unwl`, `wlist`, `purge`, `cs`, `afk`, `afkoff`, `block`, `unblock`, `mute`, `unmute`, `leave` |

`insult`/`roast`/`compliment`/`ship`/`slap`/`hug` reply to someone's message to target them
with a real WhatsApp @-mention. Insult/rizz/roast/compliment each have 50 distinct lines.

## Whitelist

`$wl <number>` (or reply to their message with `$wl`) lets someone else run **every
command** as if they'd typed it on your own account. Only you can manage the list.
Saved to `whitelist.json`, gitignored by default.

```
$wl 15551234567
$unwl 15551234567
$wlist
```

## Purge

`$purge <count>` deletes your last `<count>` messages (1-50) in the current chat, for
everyone. Messages outside WhatsApp's delete-for-everyone time window (roughly a couple
hours after sending) will fail and get reported as skipped — that's a platform limit.

## Custom status & AFK

```
$cs set back in 5      $cs clear
$afk in a meeting       $afkoff
```

While AFK, anyone who messages/mentions you gets an auto-reply. Sending any non-command
message yourself clears it automatically.

## Setup

```bash
npm install
cp .env.example .env
npm start
```

Scan the QR code from **Linked Devices** in WhatsApp. Session is cached in `.wwebjs_auth/`.

## Troubleshooting: cryptic Puppeteer/evaluate errors

`index.js` pins a known-good WhatsApp Web version via `webVersionCache`, and all quoted-
message/mention lookups go through `utils/safe.js`, which catches lookup failures instead
of crashing. If errors still happen: delete `.wwebjs_auth/` and rescan the QR (stale
session), or bump the `webVersionCache` URL in `index.js` to a newer snapshot from
https://github.com/wppconnect-team/wa-version.

## Adding new commands

```js
module.exports = {
  name: "mycommand",
  category: "Fun", // Tracking | General | Utility | Fun | Admin
  description: "What it does",
  usage: "[optional args hint]",
  async execute(client, message, args, commands) {
    await message.reply("Hello!");
  },
};
```

Drop the file in `commands/` (single command or array) — auto-loaded on startup, shows up
under `$help <category>` automatically.
