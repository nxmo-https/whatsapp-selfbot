// WhatsApp doesn't support ANSI colors, so this leans on bold text, a clean
// unicode divider, and emoji for visual structure instead of a ``` block
// (code blocks read as "debug output," not a designed message).

const DIVIDER = "┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈";

function bold(text) {
  return `*${text}*`;
}

function italic(text) {
  return `_${text}_`;
}

/** A titled card: emoji + bold title, a soft divider, then body lines. */
function card(title, lines, emoji = "✨") {
  const body = Array.isArray(lines) ? lines.join("\n") : lines;
  const header = `${emoji} ${bold(title.toUpperCase())} ${emoji}`;
  return [header, DIVIDER, body].filter(Boolean).join("\n");
}

/** "▸ *Label:* value" line. */
function field(label, value) {
  return `▸ ${bold(label + ":")} ${value}`;
}

/** Bulleted line for lists. */
function bullet(text) {
  return `◦ ${text}`;
}

module.exports = { bold, italic, card, field, bullet, DIVIDER };
