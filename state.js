// Shared in-memory state for features that persist across messages but
// don't need disk persistence (resets on restart).

let afk = null; // { reason, since } | null — single-user selfbot, so no map needed

function setAfk(reason) {
  afk = { reason: reason || "AFK", since: Date.now() };
}

function clearAfk() {
  const was = afk;
  afk = null;
  return was;
}

function getAfk() {
  return afk;
}

module.exports = { setAfk, clearAfk, getAfk };
