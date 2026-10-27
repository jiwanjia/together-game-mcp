const test = require("node:test");
const assert = require("node:assert/strict");
const Bedroom = require("./bedroom-state.js");
const geometry = require("./bedroom-geometry.js");
const floor = require("./living-room-geometry.js");

function finish(room) {
  for (let i = 0; i < 200; i++) room.advance(.1);
}

test("bedroom projection round trips and excludes furniture", () => {
  const point = { u: .6, v: .8 };
  const restored = geometry.unproject(geometry.project(point));
  assert.ok(geometry.distance(point, restored) < 1e-12);
  for (const point of [{ u: .5, v: .2 }, { u: .15, v: .8 }, { u: NaN, v: .5 }, { u: 1, v: .5 }]) assert.equal(geometry.walkable(point), false);
});

test("shared pathfinding routes around bedroom furniture without changing default geometry", () => {
  const start = { u: .16, v: .15 }, target = { u: .6, v: .6 };
  const path = geometry.findPath(start, target);
  assert.ok(path.length > 1);
  let previous = start;
  for (const point of path) {
    assert.ok(floor.clearSegment(previous, point, geometry.walkable));
    previous = point;
  }
  assert.equal(floor.findPath(start, target), null);
});

test("trio waits for every resident, then uses approved head positions", () => {
  const room = new Bedroom();
  assert.ok(room.restTogether().ok);
  room.advance(.1);
  assert.equal(room.resting, false);
  assert.equal(room.settling, true);
  finish(room);
  assert.equal(room.resting, true);
  for (const [id, actor] of Object.entries(room.snapshot().actors)) {
    assert.equal(actor.posture, "sleeping");
    assert.deepEqual(actor.screen, geometry.heads[id]);
    assert.deepEqual(room.positions()[id], geometry.bedside[id]);
  }
});

test("moving or standing one resident wakes everyone", () => {
  for (const action of [room => room.move("yu", { u: .5, v: .7 }), room => room.stand("yan"), room => room.wake()]) {
    const room = new Bedroom();
    room.restTogether(); finish(room);
    assert.ok(action(room).ok);
    assert.equal(room.resting, false);
    assert.equal(room.settling, false);
    assert.ok(Object.values(room.snapshot().actors).every(actor => actor.posture !== "sleeping"));
  }
});

test("invalid walking target preserves sleeping group atomically", () => {
  const room = new Bedroom();
  room.restTogether(); finish(room);
  const before = room.snapshot();
  assert.equal(room.move("yan", { u: .5, v: .2 }).ok, false);
  assert.deepEqual(room.snapshot(), before);
});

test("tool identities cannot move Yueyue or request solo or group sleep", () => {
  const room = new Bedroom();
  for (const command of [{ action: "move", actor: "yueyue", u: .5, v: .7 }, { action: "lie" }, { action: "rest_together" }]) assert.equal(room.command(command).ok, false);
  assert.equal(room.command({ action: "stand" }, "yueyue").ok, false);
  assert.equal(room.command({ action: "stand", revision: -1 }).ok, false);
  assert.equal(room.revision, 0);
});

test("each companion has independent speech and own movement", () => {
  const room = new Bedroom();
  const moon = room.positions().yueyue;
  assert.ok(room.command({ action: "say", text: "Hello Yueyue" }, "yan").ok);
  assert.ok(room.command({ action: "say", text: "Good evening" }, "yu").ok);
  assert.ok(room.snapshot().speeches.yan);
  assert.ok(room.snapshot().speeches.yu);
  assert.equal(room.snapshot().speeches.yueyue, null);
  assert.ok(room.command({ action: "come" }, "yu").ok);
  finish(room);
  assert.deepEqual(room.positions().yueyue, moon);
});

test("restore only valid floor positions, never sleep, paths or speeches", () => {
  const room = new Bedroom({ yan: { u: .5, v: .8, path: [{}], posture: "sleeping" }, yu: { u: .5, v: .2 } });
  assert.deepEqual(room.positions().yan, { u: .5, v: .8 });
  assert.deepEqual(room.positions().yu, { u: .47, v: .90 });
  assert.equal(room.resting, false);
  assert.equal(room.snapshot().actors.yan.posture, "standing");
  room.restTogether(); room.pause(); finish(room);
  assert.equal(room.resting, false);
  assert.equal(room.settling, false);
});
