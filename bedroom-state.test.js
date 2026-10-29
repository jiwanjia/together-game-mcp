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

for (const id of ["yan", "yu"]) {
  test(`inviting ${id} waits without moving anyone; only that companion can accept`, () => {
    const room = new Bedroom();
    const before = room.positions();
    const result = room.rest.invite(id);
    assert.deepEqual(room.positions(), before);
    assert.equal(room.settling, false);
    const other = id === "yan" ? "yu" : "yan";
    assert.equal(room.command({ action: "accept_rest", requestId: result.requestId }, other).ok, false);
    assert.ok(room.command({ action: "accept_rest", requestId: result.requestId }, id).ok);
    assert.equal(room.resting, false);
    finish(room);
    assert.equal(room.resting, true);
    assert.deepEqual(room.snapshot().rest.participants, ["yueyue", id]);
    assert.equal(room.snapshot().actors[other].posture, "standing");
    assert.deepEqual(room.positions()[other], before[other]);
  });
  test(`${id} can decline and old responses cannot answer a later invitation`, () => {
    const room = new Bedroom();
    const before = room.positions();
    const first = room.rest.invite(id);
    assert.ok(room.command({ action: "decline_rest", requestId: first.requestId }, id).ok);
    assert.deepEqual(room.positions(), before);
    const second = room.rest.invite(id);
    assert.notEqual(first.requestId, second.requestId);
    assert.equal(room.command({ action: "accept_rest", requestId: first.requestId }, id).ok, false);
    assert.equal(room.rest.invitation.id, second.requestId);
  });
}

test("pair rest allows the outsider to walk without waking the couple", () => {
  const room = new Bedroom();
  const request = room.rest.invite("yan");
  room.command({ action: "accept_rest", requestId: request.requestId });
  finish(room);
  assert.ok(room.move("yu", { u: .6, v: .8 }).ok);
  finish(room);
  assert.equal(room.resting, true);
  assert.equal(room.snapshot().actors.yan.posture, "sleeping");
  assert.equal(room.command({ action: "wake" }, "yu").ok, false);
  room.stand("yan");
  assert.equal(room.resting, false);
});

test("expired, cancelled, paused or interrupted invitations cannot start rest", () => {
  for (const cancel of [room => room.advance(0, 120001), room => room.wake(), room => room.pause(), room => room.stand("yan")]) {
    const room = new Bedroom();
    const request = room.rest.invite("yan", 0);
    cancel(room);
    assert.equal(room.command({ action: "accept_rest", requestId: request.requestId }, "yan", 120001).ok, false);
    assert.equal(room.resting, false);
    assert.equal(room.settling, false);
  }
});

test("accepted pairs wait only for participants, and snapshots cannot rewrite membership", () => {
  const room = new Bedroom();
  const request = room.rest.invite("yu");
  room.command({ action: "accept_rest", requestId: request.requestId }, "yu");
  room.snapshot().rest.participants.push("yan");
  assert.deepEqual(room.rest.participants, ["yueyue", "yu"]);
  const restored = new Bedroom(room.positions());
  assert.deepEqual(restored.rest.participants, []);
  assert.equal(restored.rest.invitation, null);
});
