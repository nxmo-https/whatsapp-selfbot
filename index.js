require("dotenv").config();
const qrcode = require("qrcode-terminal");
const qrcodeLib = require("qrcode");
const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { loadCommands } = require("./commandHandler");
const store = require("./store");
const whitelist = require("./whitelist");
const { getAfk, clearAfk } = require("./state");

const PREFIX = process.env.PREFIX || "$";
const commands = loadCommands();

// Simple HTTP server to expose the latest QR as an image for easier linking from Railway dashboard
let latestQrDataUrl = null;
const app = express();
app.get("/qr", (req, res) => {
  if (!latestQrDataUrl) return res.status(404).send("QR not generated yet.\n");
  res.type("html").send(`<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#111;color:#fff"><div style="text-align:center"><h2>WhatsApp QR</h2><img src="${latestQrDataUrl}" alt="QR" style="max-width:90vw;max-height:80vh"/><p>Scan with WhatsApp → Linked devices → Link a device</p></div></body></html>`);
});
const webPort = process.env.PORT || 3000;
app.listen(webPort, () => console.log(`QR server listening on http://0.0.0.0:${webPort}/qr`));

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
  // Pinning a known-good WhatsApp Web version fixes cryptic internal
  // Puppeteer/evaluate errors (single-letter variable errors, quoted-message
  // lookups crashing, etc). The previous pin used an alpha 2.3xxx snapshot
  // which the whatsapp-web.js community has flagged as unstable; 2.2412.54
  // is the widely-used known-good pin as of this writing. If WhatsApp forces
  // a newer version and this stops working, check
  // https://github.com/wppconnect-team/wa-version/tree/main/html for a
  // newer snapshot and swap the version number below.
  webVersionCache: {
    type: "remote",
    remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  },
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    // Point at your existing Edge/Chrome install instead of downloading Chromium.
    // Set EXECUTABLE_PATH in .env, e.g.:
    // Windows: C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
    // Mac:     /Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge
    // Linux:   /usr/bin/microsoft-edge
    executablePath: process.env.EXECUTABLE_PATH || undefined,
  },
});

client.on("qr", (qr) => {
  console.log("Scan this QR code with WhatsApp (Linked Devices > Link a Device):");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("Authenticated.");
});

client.on("ready", () => {
  console.log(`Selfbot ready. Logged in as ${client.info.pushname || client.info.wid.user}.`);
  console.log(`Prefix: ${PREFIX}  |  Loaded commands: ${[...commands.keys()].join(", ")}`);
});

client.on("auth_failure", (msg) => {
  console.error("Auth failure:", msg);
});

client.on("disconnected", (reason) => {
  console.log("Client disconnected:", reason);
});

// --- Snipe: capture messages right before they're deleted-for-everyone ---
client.on("message_revoke_everyone", async (_after, before) => {
  if (!before) return; // no cached copy available
  try {
    const chat = await before.getChat();
    store.addDeleted(chat.id._serialized, {
      body: before.body,
      author: before.author || before.from,
      timestamp: before.timestamp ? before.timestamp * 1000 : Date.now(),
      type: before.type,
    });
  } catch (err) {
    console.error("[snipe] failed to cache revoked message:", err.message);
  }
});

// --- Snipe (fallback path): also cache every message we see as it comes
// in. message_revoke_everyone only fires for a real "delete for everyone",
// and even then only if whatsapp-web.js's own cache still had the message.
// This gives us an independent, reliable source for !snipe regardless of
// that event firing or not - a local delete-for-me still shows up here
// because we cache proactively rather than reactively. ---
client.on("message_create", async (message) => {
  try {
    const chat = await message.getChat();
    store.cacheMessage(chat.id._serialized, message.id._serialized, {
      body: message.body,
      author: message.author || message.from,
      timestamp: message.timestamp ? message.timestamp * 1000 : Date.now(),
      type: message.type,
    });
  } catch {
    // best-effort cache, ignore failures
  }
});

client.on("message_delete", async (message) => {
  try {
    const chat = await message.getChat();
    const cached = store.getCachedMessage(chat.id._serialized, message.id._serialized);
    if (cached) store.addDeleted(chat.id._serialized, cached);
  } catch (err) {
    console.error("[snipe] failed on message_delete:", err.message);
  }
});

// --- Editsnipe: capture edits ---
client.on("message_edit", async (message, newBody, oldBody) => {
  try {
    const chat = await message.getChat();
    store.addEdited(chat.id._serialized, {
      before: oldBody,
      after: newBody,
      author: message.author || message.from,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("[editsnipe] failed to cache edit:", err.message);
  }
});

// --- AFK: auto-reply when someone messages/mentions you while you're AFK ---
client.on("message_create", async (message) => {
  if (message.fromMe) {
    // You sending a message while AFK counts as "you're back."
    if (getAfk() && !message.body.startsWith(PREFIX)) clearAfk();
    return;
  }
  const afk = getAfk();
  if (!afk) return;
  const mins = Math.floor((Date.now() - afk.since) / 60000);
  message
    .reply(`\`AFK\`: ${afk.reason} (away ${mins}m)`)
    .catch(() => {});
});


client.on("message_create", async (message) => {
  const senderId = message.fromMe ? client.info.wid._serialized : message.author || message.from;
  const authorized = message.fromMe || whitelist.isWhitelisted(senderId);
  if (!authorized) return;
  if (!message.body || !message.body.startsWith(PREFIX)) return;

  const args = message.body.slice(PREFIX.length).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();
  const command = commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(client, message, args, commands);
  } catch (err) {
    console.error(`[command:${commandName}] error:`, err.stack || err);
    message.reply(`Small Error With ${commandName}. We will fix it soon.`).catch(() => {});
  }
});

client.initialize();
