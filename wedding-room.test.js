const { test } = require("node:test");
const assert = require("node:assert/strict");
const { WeddingRoom, project, unproject, validPoint } = require("./wedding-room-state.js");
const storage = require("./wedding-room-storage.js");
const { splitVowLines } = require("./wedding-ceremony.js");

function settle(room) { for (let i = 0; i < 100; i++) room.advance(.1); }
function arrive(room) {
  room.move("yueyue", { u: -.5, v: .025 });
  room.move("yan", { u: .5, v: .025 });
  settle(room);
}
function memoryStore() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
test("aisle projection round-trips and excludes pews along the whole path", () => {
  for (let v = 0; v <= 1; v += .05) {
    for (const u of [-1, -.5, 0, .5, 1]) {
      const point = project({ u, v });
      const restored = unproject(point);
      assert.ok(Math.abs(restored.u - u) < 1e-10);
      assert.ok(Math.abs(restored.v - v) < 1e-10);
      assert.ok(point.x >= .37 && point.x <= .63);
    }
  }
  assert.equal(validPoint(unproject({ x: .25, y: .75 })), false);
  assert.equal(validPoint(unproject({ x: .8, y: .65 })), false);
  assert.equal(validPoint({ u: NaN, v: .5 }), false);
  assert.equal(validPoint({ u: 0, v: -1 }), false);
});
test("walking stays in the aisle, uses rear sprites, and gates vows on both arrivals", () => {
  const room = new WeddingRoom();
  assert.equal(room.begin().ok, false);
  room.move("yueyue", { u: -.5, v: .025 });
  assert.equal(room.actors.yueyue.facing, "back");
  settle(room);
  assert.equal(room.ready(), false);
  room.move("yan", { u: .5, v: .025 });
  for (let i = 0; i < 100; i++) {
    room.advance(.1);
    for (const actor of Object.values(room.actors)) assert.ok(validPoint(actor));
  }
  assert.equal(room.ready(), true);
  assert.equal(room.begin().ok, true);
  assert.equal(room.move("yan", { u: 0, v: .5 }).ok, false);
});
test("companion commands cannot move Yueyue, accept vows or reuse stale revisions", () => {
  const room = new WeddingRoom();
  const before = room.snapshot().actors.yueyue;
  for (const action of ["move", "come", "face"]) assert.equal(room.command({ action, actor: "yueyue", u: 0, v: .5 }).ok, false);
  assert.equal(room.command({ action: "begin" }).ok, false);
  assert.equal(room.command({ action: "move", revision: -1, u: 0, v: .5 }).ok, false);
  assert.deepEqual(room.snapshot().actors.yueyue, before);
  assert.equal(room.command({ action: "move", u: Infinity, v: .5 }).ok, false);
});
test("cancel never completes vows; a completed replay uses the kept words, not new drafts", () => {
  const room = new WeddingRoom();
  arrive(room);
  room.draft("yueyue", "月月亲手写的第一版");
  room.begin(); room.next(); room.pause();
  assert.equal(room.completed, null);
  room.begin();
  for (let i = 0; i < 4; i++) room.next();
  const kept = JSON.stringify(room.completed);
  room.draft("yueyue", "后来修改的草稿");
  room.begin(true);
  assert.equal(room.ceremony.vows.yueyue, "月月亲手写的第一版");
  for (let i = 0; i < 4; i++) room.next();
  assert.equal(JSON.stringify(room.completed), kept);
});
test("draft limits, empty vows, pause and refresh do not restore an unfinished ceremony", () => {
  const room = new WeddingRoom();
  assert.equal(room.draft("yueyue", "♡".repeat(1201)), false);
  assert.equal(room.drafts.yueyue, "");
  arrive(room); room.begin();
  const restored = new WeddingRoom(room.record());
  assert.equal(restored.ceremony, null);
  assert.equal(restored.completed, null);
  room.pause(); assert.equal(room.ceremony, null);
  assert.equal(room.draft("__proto__", "x"), false);
});
test("malformed and incompatible saves survive unchanged and cannot be overwritten", () => {
  for (const raw of ["{broken", JSON.stringify({ version: 9 }), JSON.stringify({ ...new WeddingRoom().record(), completed: {} })]) {
    const store = memoryStore(); store.setItem(storage.key, raw);
    const persistence = storage.create(store);
    assert.equal(persistence.load(), null);
    assert.equal(persistence.save(new WeddingRoom().record()), false);
    assert.equal(store.getItem(storage.key), raw);
  }
});
test("preview storage is isolated and only the wedding key is written", () => {
  const localStorage = memoryStore();
  const sessionStorage = memoryStore();
  localStorage.setItem("playtogether-living-room-v1", "keep the living room");
  const page = { location: { search: "?preview" }, localStorage, sessionStorage };
  const preview = storage.forPage(page);
  assert.equal(preview.load(), null);
  assert.equal(preview.save(new WeddingRoom().record()), true);
  assert.equal(localStorage.getItem(storage.key), null);
  assert.equal(localStorage.getItem("playtogether-living-room-v1"), "keep the living room");
  assert.equal(storage.validRecord(JSON.parse(sessionStorage.getItem(storage.key))), true);
  const realPage = storage.forPage({ ...page, location: { search: "" } });
  assert.equal(realPage.save(new WeddingRoom().record()), true);
  assert.equal(localStorage.values.size, 2);
});

test("page follow keeps Yan alongside Yueyue inside the aisle, including at the front", () => {
  const room = new WeddingRoom();
  assert.equal(room.follow().ok, true);
  room.move("yueyue", { u: -.6, v: .025 });
  for (let i = 0; i < 160; i++) {
    room.advance(.1);
    for (const actor of Object.values(room.actors)) assert.equal(validPoint(actor), true);
  }
  assert.equal(room.following, true);
  assert.ok(Math.abs(room.actors.yan.v - room.actors.yueyue.v) < .01);
  assert.ok(room.actors.yan.u > 0 && room.actors.yueyue.u < 0);
  assert.equal(room.ready(), true);
  room.begin();
  assert.equal(room.following, false);
});
test("follow starts only through the page and stops on manual companion control or explicit stop", () => {
  const room = new WeddingRoom();
  assert.equal(room.command({ action: "follow" }).ok, false);
  assert.equal(room.command({ action: "follow_yueyue" }).ok, false);
  room.follow(); room.move("yueyue", { u: -.4, v: .2 }); room.advance(.1);
  assert.equal(room.command({ action: "stop_follow" }).ok, true);
  assert.equal(room.actors.yan.target, null);
  const before = { ...room.actors.yan };
  settle(room);
  assert.deepEqual(room.actors.yan, before);
  room.follow(); room.command({ action: "move", u: -.5, v: .6 });
  assert.equal(room.following, false);
  room.follow(); room.command({ action: "face", direction: "yueyue" });
  assert.equal(room.following, false);
  assert.equal(room.actors.yan.target, null);
});
test("pause and refresh clear following without changing drafts or completed vows", () => {
  const room = new WeddingRoom();
  arrive(room); room.draft("yueyue", "原来的誓词"); room.begin();
  for (let i = 0; i < 4; i++) room.next();
  const kept = JSON.stringify({ drafts: room.drafts, completed: room.completed });
  room.follow();
  assert.equal(room.following, true);
  assert.equal(new WeddingRoom(room.record()).following, false);
  assert.equal(Object.hasOwn(room.record(), "following"), false);
  room.pause();
  assert.equal(room.following, false);
  assert.equal(JSON.stringify({ drafts: room.drafts, completed: room.completed }), kept);
  room.begin(true); assert.equal(room.follow().ok, false); room.pause();
  assert.equal(JSON.stringify({ drafts: room.drafts, completed: room.completed }), kept);
});
test("spoken vows split at punctuation and bound long Unicode lines without changing stored words", () => {
  const vow = "这是第一句测试誓词。这是第二句测试誓词。";
  assert.deepEqual(splitVowLines(vow), ["这是第一句测试誓词。", "这是第二句测试誓词。"]);
  const long = "♡".repeat(150);
  const lines = splitVowLines(long);
  assert.ok(lines.every(line => Array.from(line).length <= 64));
  assert.equal(lines.join(""), long);
  assert.deepEqual(splitVowLines("Hello. Still here!"), ["Hello.", "Still here!"]);
  assert.equal(splitVowLines("……...").join(""), "……...");
  assert.deepEqual(splitVowLines(""), []);
});
