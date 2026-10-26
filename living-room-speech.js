(function (root) {
  "use strict";
  class Speech {
    constructor(actor = "yan") { this.actor = actor; this.current = null; }
    say(text, now = Date.now()) {
      if (typeof text !== "string") return { ok: false, error: "请给一句文字。" };
      const trimmed = text.trim();
      const length = Array.from(trimmed).length;
      if (!length || length > 240) return { ok: false, error: "一句话请写1–240个字。" };
      const duration = Math.min(30000, Math.max(12000, length * 100));
      this.current = { actor: this.actor, text: trimmed, expiresAt: now + duration };
      return { ok: true, status: "displayed" };
    }
    snapshot() { return this.current ? { ...this.current } : null; }
    clear() {
      const hadSpeech = Boolean(this.current);
      this.current = null;
      return hadSpeech;
    }
    expire(now = Date.now()) {
      return this.current && now >= this.current.expiresAt ? this.clear() : false;
    }
  }
  if (typeof module === "object" && module.exports) module.exports = Speech;
  else root.LivingRoomSpeech = Speech;
})(typeof window === "undefined" ? globalThis : window);
