const { test } = require("node:test");
const assert = require("node:assert/strict");
const geometry = require("./living-room-geometry.js");
const Room = require("./living-room-state.js");
function settle(room) { for (let tick = 0; tick < 160; tick++) room.advance(.1, 10); }

test("projection roundtrip and outside/furniture destinations are rejected", () => {
  const point = { u: .66, v: .24 };
  const restored = geometry.unproject(geometry.project(point));
  assert.ok(geometry.distance(point, restored) < 1e-10);
  assert.equal(geometry.walkable({ u: .4, v: .5 }), false);
  assert.equal(geometry.walkable({ u: -1, v: .3 }), false);
  const room = new Room();
  assert.equal(room.command({ action: "move", u: Infinity, v: .4 }).ok, false);
  assert.equal(room.command({ action: "move", u: .4, v: .5 }).ok, false);
});
test("movement routes around the coffee table without cutting corners", () => {
  const start = { u: .65, v: .47 }, target = { u: .29, v: .47 };
  assert.equal(geometry.clearSegment(start, target), false);
  const path = geometry.findPath(start, target);
  assert.ok(path && path.length > 1);
  let previous = start;
  for (const point of path) { assert.equal(geometry.clearSegment(previous, point), true); previous = point; }
  const room = new Room();
  assert.equal(room.move("yueyue", target).ok, true); settle(room);
  assert.ok(geometry.distance(room.actors.yueyue, target) < .0001);
});
test("actor tool cannot move the user or approve follow, and rejects stale state", () => {
  const room = new Room(), before = room.snapshot().actors.yueyue;
  assert.equal(room.command({ action: "move", actor: "yueyue", u: .8, v: .8 }).ok, false);
  assert.equal(room.command({ action: "accept_follow" }).ok, false);
  assert.equal(room.command({ action: "come", revision: -1 }).ok, false);
  assert.deepEqual(room.snapshot().actors.yueyue, before);
  assert.equal(room.command({ action: "observe" }).ok, true);
});
test("seats reserve immediately, settle at their approach and can be released", () => {
  const room = new Room();
  assert.equal(room.sit("yueyue", 1).ok, true);
  assert.equal(room.command({ action: "sit", seat: 1 }).ok, false);
  assert.equal(room.command({ action: "sit", seat: 2 }).ok, true); settle(room);
  assert.equal(room.snapshot().actors.yueyue.posture, "sitting");
  assert.equal(room.snapshot().actors.yan.posture, "sitting");
  assert.equal(room.sit("yan", "0").ok, false);
  room.move("yueyue", { u: .7, v: .3 }); settle(room);
  assert.equal(room.occupant(1), null);
});
test("follow only starts on current user approval; rejection/expiry keep autonomy", () => {
  const room = new Room();
  const invite = room.command({ action: "invite_follow", accepted: true }, 10);
  assert.equal(room.following, false);
  assert.equal(room.respond("wrong", true, 11).ok, false);
  assert.equal(room.respond(invite.requestId, false, 11).ok, true);
  assert.equal(room.following, false);
  const next = room.command({ action: "invite_follow" }, 20);
  room.advance(0, 120020);
  assert.equal(room.respond(next.requestId, true, 120021).ok, false);
  assert.equal(room.following, false);
});
test("approved follow moves both, pairs seats and user movement stops it", () => {
  const room = new Room();
  const invite = room.command({ action: "invite_follow" }, 10);
  room.respond(invite.requestId, true, 11);
  assert.equal(room.command({ action: "move", u: .74, v: .70 }).ok, true); settle(room);
  assert.ok(geometry.distance(room.actors.yueyue, room.actors.yan) < .19);
  assert.equal(room.command({ action: "sit", seat: 1 }).ok, true); settle(room);
  assert.equal(room.actors.yan.seat, 1);
  assert.equal(room.actors.yueyue.seat, 0);
  room.stand("yan");
  assert.equal(room.actors.yueyue.seat, null);
  room.move("yueyue", { u: .75, v: .3 });
  assert.equal(room.following, false);
  assert.equal(room.invitation, null);
});
test("explicit stop cancels follower travel and releases an unfinished reservation", () => {
  const room = new Room();
  const invite = room.command({ action: "invite_follow" }, 10);
  room.respond(invite.requestId, true, 11);
  room.command({ action: "sit", seat: 2 });
  room.stopFollow();
  assert.equal(room.following, false);
  assert.equal(room.actors.yueyue.path.length, 0);
  assert.equal(room.actors.yueyue.seat, null);
});
test("saved positions restore without old invitations, consent or moving paths", () => {
  const room = new Room({ yueyue: { u: .75, v: .7, seat: 1 }, yan: { u: .7, v: .6, seat: 1 } });
  assert.equal(room.actors.yueyue.seat, 1);
  assert.equal(room.actors.yan.seat, null);
  assert.equal(room.following, false);
  assert.equal(room.invitation, null);
  assert.equal(room.command(null).ok, false);
  room.inviteFromUser("come");
  assert.equal(room.command({ action: "come" }).ok, true);
  assert.equal(room.requests[0].status, "handled");
});
