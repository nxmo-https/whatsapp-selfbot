const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "whitelist.json");

function load() {
  try {
    return new Set(JSON.parse(fs.readFileSync(FILE, "utf8")));
  } catch {
    return new Set();
  }
}

function save(set) {
  fs.writeFileSync(FILE, JSON.stringify([...set], null, 2));
}

let whitelist = load();

/**
 * Normalize any WhatsApp ID or raw phone number down to just its digits,
 * always stored as digits@c.us. This is the actual whitelist fix: WhatsApp
 * IDs show up with different domain suffixes depending on context (@c.us,
 * @lid, @s.whatsapp.net) - comparing full strings caused a number you
 * whitelisted to never match the sender ID whatsapp-web.js handed back.
 * Comparing on digits only sidesteps that entirely.
 */
function normalize(idOrNumber) {
  const str = String(idOrNumber || "").trim();
  const digitsOnly = str.split("@")[0].replace(/[^\d]/g, "");
  return `${digitsOnly}@c.us`;
}

function add(idOrNumber) {
  const id = normalize(idOrNumber);
  whitelist.add(id);
  save(whitelist);
  return id;
}

function remove(idOrNumber) {
  const id = normalize(idOrNumber);
  const existed = whitelist.delete(id);
  save(whitelist);
  return existed;
}

function isWhitelisted(id) {
  if (!id) return false;
  return whitelist.has(normalize(id));
}

function list() {
  return [...whitelist];
}

module.exports = { add, remove, isWhitelisted, list, normalize };
