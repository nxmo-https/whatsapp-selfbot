// In-memory stores keyed by chat ID. Reset on restart by design - a "catch
// it right after it happened" tool, not a permanent log.
//
// messageCache holds every recent message the bot has seen (a rolling
// window per chat), independent of deletion events. This exists because
// message_revoke_everyone only fires for "delete for everyone" - a plain
// local-only delete on the sender's device never fires it, and even for
// real revokes the "before" copy is only available if whatsapp-web.js still
// had it cached. Keeping our own short-lived cache means !snipe can recover
// a message whether or not the library's own cache still had it.

const SNIPE_CACHE_SIZE = parseInt(process.env.SNIPE_CACHE_SIZE || "1", 10);
const MESSAGE_CACHE_PER_CHAT = 50;

class SnipeStore {
  constructor() {
    this.deleted = new Map(); // chatId -> entries[]
    this.edited = new Map(); // chatId -> entries[]
    this.messageCache = new Map(); // chatId -> Map<messageId, entry>
  }

  cacheMessage(chatId, messageId, entry) {
    const chatCache = this.messageCache.get(chatId) || new Map();
    chatCache.set(messageId, entry);
    if (chatCache.size > MESSAGE_CACHE_PER_CHAT) {
      const oldestKey = chatCache.keys().next().value;
      chatCache.delete(oldestKey);
    }
    this.messageCache.set(chatId, chatCache);
  }

  getCachedMessage(chatId, messageId) {
    return this.messageCache.get(chatId)?.get(messageId) || null;
  }

  addDeleted(chatId, entry) {
    const list = this.deleted.get(chatId) || [];
    list.unshift(entry);
    if (list.length > SNIPE_CACHE_SIZE) list.length = SNIPE_CACHE_SIZE;
    this.deleted.set(chatId, list);
  }

  getDeleted(chatId) {
    const list = this.deleted.get(chatId);
    return list && list.length ? list[0] : null;
  }

  clearDeleted(chatId) {
    this.deleted.delete(chatId);
  }

  addEdited(chatId, entry) {
    const list = this.edited.get(chatId) || [];
    list.unshift(entry);
    if (list.length > SNIPE_CACHE_SIZE) list.length = SNIPE_CACHE_SIZE;
    this.edited.set(chatId, list);
  }

  getEdited(chatId) {
    const list = this.edited.get(chatId);
    return list && list.length ? list[0] : null;
  }

  clearEdited(chatId) {
    this.edited.delete(chatId);
  }
}

module.exports = new SnipeStore();
