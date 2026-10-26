(function (root) {
  "use strict";
  const key = "playtogether-wedding-v1";
  function validText(text) { return typeof text === "string" && Array.from(text).length <= 1200; }
  function validRecord(value) {
    if (!value || value.version !== 1) return false;
    for (const id of ["yueyue", "yan"]) {
      const actor = value.actors?.[id];
      if (!actor || !Number.isFinite(actor.u) || Math.abs(actor.u) > 1 ||
          !Number.isFinite(actor.v) || actor.v < 0 || actor.v > 1 || !["front", "back"].includes(actor.facing)) return false;
      if (!validText(value.drafts?.[id])) return false;
    }
    if (value.completed !== null && (!value.completed || !Number.isFinite(Date.parse(value.completed.at)) ||
        !validText(value.completed.vows?.yueyue) || !validText(value.completed.vows?.yan))) return false;
    return true;
  }
  function create(storage) {
    let blocked = false;
    let message = "Saved in this browser.";
    return {
      load() {
        try {
          const raw = storage.getItem(key);
          if (raw === null) return null;
          const value = JSON.parse(raw);
          if (!validRecord(value)) throw new Error("Invalid wedding save");
          return value;
        } catch (_) { blocked = true; message = "The existing save could not be read. It has been kept; this visit will not overwrite it."; return null; }
      },
      save(record) {
        if (blocked) return false;
        try {
          if (!validRecord(record)) throw new Error("Invalid wedding state");
          storage.setItem(key, JSON.stringify(record));
          message = "Saved in this browser.";
          return true;
        } catch (_) { message = "Saving is unavailable. You can still play during this visit."; return false; }
      },
      message: () => message
    };
  }
  function forPage(page) {
    let storage;
    try { storage = new URLSearchParams(page.location.search).has("preview") ? page.sessionStorage : page.localStorage; }
    catch (_) { storage = { getItem() { throw new Error("Storage unavailable"); } }; }
    return create(storage);
  }
  const api = { key, validRecord, create, forPage };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeddingRoomStorage = api;
})(typeof window === "undefined" ? globalThis : window);
