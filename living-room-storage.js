window.LivingRoomStorage = (function () {
  "use strict";
  const key = "playtogether-living-room-v1";
  let store, error = "", blocked = false;
  try { store = location.search.includes("preview") ? sessionStorage : localStorage; }
  catch (_) { error = "暂时不能保存位置，本次仍可以玩。"; }
  function load() {
    if (!store) return null;
    try {
      const raw = store.getItem(key);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || !saved.actors || typeof saved.actors !== "object") throw new Error("Invalid save");
      return saved.actors;
    } catch (_) { blocked = true; error = "旧位置记录暂时读不了，原记录保留；这次从客厅出发。"; return null; }
  }
  function save(actors) {
    if (!store || blocked) return;
    try {
      const records = Object.fromEntries(Object.entries(actors).map(([id, actor]) => [id,
        { u: actor.u, v: actor.v, seat: actor.path.length ? null : actor.seat }]));
      store.setItem(key, JSON.stringify({ version: 1, actors: records }));
      error = "";
    } catch (_) { error = "位置暂时没保存成功，本次仍可以玩。"; }
  }
  return { load, save, message: () => error || "位置会留在这扇浏览器里；跟随每次都由月月决定。" };
})();
