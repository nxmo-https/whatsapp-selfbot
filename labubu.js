require("dotenv").config();
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { loadCommands } = require("./utils/commandHandler");
const store = require("./utils/store");
const whitelist = require("./utils/whitelist");
const { getAfk, clearAfk } = require("./utils/state");
const { safeGetMentions } = require("./utils/safe");

const PREFIX = process.env.PREFIX || "$";
const commands = loadCommands();
const COLORS = { reset: "\x1b[0m", cyan: "\x1b[31m", green: "\x1b[31m", yellow: "\x1b[31m", red: "\x1b[31m", gray: "\x1b[31m", white: "\x1b[31m" };

function terminalLog(level, message, color = "white") {
  const time = new Date().toLocaleTimeString([], { hour12: false });
  console.log(`${COLORS.gray}[${time}]${COLORS.reset} ${COLORS[color]}${level.padEnd(5)}${COLORS.reset} ${message}`);
}

function terminalError(level, message, error) {
  terminalLog(level, `${message}${error ? `: ${error.message || error}` : ""}`, "red");
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
  webVersionCache: {
    type: "remote",
    remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  },
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: process.env.EXECUTABLE_PATH || undefined,
  },
});

client.on("qr", (qr) => {
  terminalLog("QR", "Scan with WhatsApp > Linked Devices > Link a Device", "yellow");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  terminalLog("AUTH", "Authenticated", "green");
});

client.on("ready", () => {
  terminalLog("Ready to use", `as ${client.info.pushname || client.info.wid.user}`, "green");
  terminalLog("BOT", `Prefix ${PREFIX} | ${commands.size} commands loaded`, "cyan");
});

client.on("auth_failure", (msg) => {
  terminalError("ERROR", "Authentication failed", { message: msg });
});

client.on("disconnected", (reason) => {
  terminalLog("STOP", `Disconnected: ${reason}`, "yellow");
});

async function captureDeletedMessage(message, before, eventName) {
  try {
    const messageId = (message && message.id && message.id._serialized) || (before && before.id && before.id._serialized);
    const cached = messageId ? store.getCachedMessage(null, messageId) : null;
    const source = before || cached || message;
    if (!source) return;

    const sourceFromMe = Boolean(source.fromMe || (message && message.fromMe));
    let chatId = (cached && cached.chatId) || source.chatId;
    if (!chatId) chatId = sourceFromMe ? source.to || (message && message.to) : source.from || (message && message.from);
    if (!chatId && source.chatId) chatId = source.chatId;
    if (!chatId) {
      const chat = await source.getChat();
      chatId = chat.id._serialized;
    }

    store.addDeleted(chatId, {
      messageId,
      body: source.body,
      author: source.author || source.from,
      timestamp: source.timestamp ? source.timestamp * 1000 : Date.now(),
      type: source.type,
    });
  } catch (err) {
    terminalError("SNIPE", `${eventName} failed`, err);
  }
}

client.on("message_revoke_everyone", (after, before) => captureDeletedMessage(after, before, "revoke_everyone"));
client.on("message_revoke_me", (message, before) => captureDeletedMessage(message, before, "revoke_me"));

client.on("message_create", async (message) => {
  const messageId = message.id && message.id._serialized;
  let chatId = message.fromMe ? message.to : message.from;
  try {
    const chat = await message.getChat();
    chatId = chat.id._serialized;
  } catch (err) {
    if (!chatId) terminalError("SNIPE", "Unable to identify message chat", err);
  }
  if (messageId && chatId) {
    store.cacheMessage(chatId, messageId, {
      chatId,
      fromMe: message.fromMe,
      body: message.body,
      author: message.author || message.from,
      timestamp: message.timestamp ? message.timestamp * 1000 : Date.now(),
      type: message.type,
    });
  } else {
    terminalLog("SNIPE", "Message skipped: no chat or message ID", "yellow");
  }
});

client.on("message_delete", async (message) => {
  await captureDeletedMessage(message, null, "delete");
});

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
    terminalError("SNIPE", "Edit capture failed", err);
  }
});

client.on("message_create", async (message) => {
  if (message.fromMe) {
    const afk = getAfk();
    const isAfkReply = message.body && message.body.startsWith("`AFK`:");
    if (afk && !isAfkReply && !message.body.startsWith(PREFIX) && Date.now() - afk.since > 3000) clearAfk();
    return;
  }
  const afk = getAfk();
  if (!afk) return;
  const chat = await message.getChat().catch(() => null);
  if (chat && chat.isGroup) {
    const mentions = await safeGetMentions(message);
    const ownerId = client.info && client.info.wid && client.info.wid._serialized;
    const ownerNumber = client.info && client.info.wid && client.info.wid.user;
    const mentionedOwner = mentions.some((contact) => {
      const id = contact && contact.id;
      return id && (id._serialized === ownerId || id.user === ownerNumber);
    });
    if (!mentionedOwner) return;
  }
  const mins = Math.floor((Date.now() - afk.since) / 60000);
  message
    .reply(`\`AFK\`: ${afk.reason} (away ${mins}m)`)
    .catch(() => {});
});

async function isAuthorizedMessage(message) {
  if (message.fromMe) return true;

  const senderIds = [message.author, message.from];
  try {
    const sender = await message.getContact();
    senderIds.push(sender && sender.number);
    senderIds.push(sender && sender.id && sender.id._serialized);
  } catch {
  }

  try {
    const chat = await message.getChat();
    if (!chat.isGroup) {
      senderIds.push(chat.id && chat.id._serialized);
      const contact = await chat.getContact();
      senderIds.push(contact && contact.number);
      senderIds.push(contact && contact.id && contact.id._serialized);
    }
  } catch {
  }

  for (const id of [...senderIds]) {
    if (!id) continue;
    const contact = await client.getContactById(id).catch(() => null);
    if (contact) {
      senderIds.push(contact.number);
      senderIds.push(contact.id && contact.id._serialized);
    }
  }

  const matchedId = senderIds.filter(Boolean).find((id) => whitelist.isWhitelisted(id));
  if (matchedId) {
    console.log(`[whitelist] authorized sender ${matchedId}`);
    return true;
  }
  return false;
}

client.on("message_create", async (message) => {
  const authorized = await isAuthorizedMessage(message);
  if (!authorized) return;
  if (!message.body || !message.body.startsWith(PREFIX)) return;

  const args = message.body.slice(PREFIX.length).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();
  const command = commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(client, message, args, commands);
  } catch (err) {
    terminalError("CMD", `${commandName} failed`, err);
    message.reply(`Error running ${commandName}. Check the terminal log for details.`).catch(() => {});
  }
});

client.initialize();
