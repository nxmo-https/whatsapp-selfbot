// message.getQuotedMessage() / message.getMentions() run inside WhatsApp
// Web's own page context via Puppeteer. If the quoted message isn't in
// WhatsApp's internal store yet (e.g. quoting something sent moments ago,
// an old/unsynced message, or a system message), the underlying evaluate()
// call throws instead of returning null. These wrappers catch that so a
// lookup failure degrades to "couldn't resolve" instead of crashing the
// whole command.

async function safeGetQuotedMessage(message) {
  if (!message.hasQuotedMsg) return null;
  try {
    return await message.getQuotedMessage();
  } catch (err) {
    console.warn("[safe] getQuotedMessage failed:", err.message);
    return null;
  }
}

async function safeGetMentions(message) {
  try {
    return await message.getMentions();
  } catch (err) {
    console.warn("[safe] getMentions failed:", err.message);
    return [];
  }
}

async function safeGetContact(quotedMessage) {
  if (!quotedMessage) return null;
  try {
    return await quotedMessage.getContact();
  } catch (err) {
    console.warn("[safe] getContact failed:", err.message);
    return null;
  }
}

module.exports = { safeGetQuotedMessage, safeGetMentions, safeGetContact };
