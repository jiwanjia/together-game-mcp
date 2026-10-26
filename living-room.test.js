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

test("tight seated pair only appears after both arrive at adjacent seats", () => {
  for (const [womanSeat, manSeat] of [[0, 1], [1, 2], [1, 0], [2, 1]]) {
    const room = new Room();
    room.sit("yueyue", womanSeat);
    room.sit("yan", manSeat);
    assert.equal(geometry.seatedPair(room.snapshot().actors), null);
    settle(room);
    const actors = room.snapshot().actors;
    const pair = geometry.seatedPair(actors);
    assert.equal(pair.mirrored, false);
    assert.equal(pair.x, (actors.yueyue.screen.x + actors.yan.screen.x) / 2 + 16);
    assert.equal(pair.y, (actors.yueyue.screen.y + actors.yan.screen.y) / 2 - 8);
    assert.equal(pair.depth, Math.max(geometry.actorDepth(actors.yueyue), geometry.actorDepth(actors.yan)));
    room.stand("yueyue");
    assert.equal(geometry.seatedPair(room.snapshot().actors), null);
  }
  const room = new Room();
  room.sit("yueyue", 0);
  room.sit("yan", 2);
  settle(room);
  assert.equal(geometry.seatedPair(room.snapshot().actors), null);
});

test("table depth uses floor front edges instead of cutting front-side actors", () => {
  for (const point of [{ u: .65, v: .35 }, { u: .59, v: .55 }, { u: .30, v: .7 }, { u: .65, v: .7 }]) {
    assert.equal(geometry.walkable(point), true);
    const actor = { ...point, posture: "standing", screen: geometry.project(point) };
    assert.ok(geometry.actorDepth(actor) > 704);
    assert.ok(geometry.actorDepth({ ...actor, posture: "walking" }) > 704);
  }
  const behind = { u: .28, v: .47 };
  assert.equal(geometry.walkable(behind), true);
  assert.ok(geometry.actorDepth({ ...behind, posture: "standing", screen: geometry.project(behind) }) < 704);
  const room = new Room();
  room.sit("yan", 0);
  settle(room);
  assert.equal(geometry.actorDepth(room.snapshot().actors.yan), Math.round(room.snapshot().actors.yan.screen.y));
});

test("standing and walking in front of the sofa stay above its armrest", () => {
  for (const point of [{ u: .28, v: .39 }, { u: .27, v: .34 }, { u: .29, v: .47 }]) {
    assert.equal(geometry.walkable(point), true);
    for (const posture of ["standing", "walking"]) {
      const actor = { ...point, posture, screen: geometry.project(point) };
      assert.ok(geometry.actorDepth(actor) > 580);
      assert.ok(geometry.actorDepth(actor) < 704);
    }
  }
  const point = { u: .28, v: .39 };
  const sitting = { ...point, posture: "sitting", screen: geometry.project(point) };
  assert.equal(geometry.actorDepth(sitting), Math.round(sitting.screen.y));
});

test("say validates public text and actor permission without changing game positions", () => {
  const room = new Room();
  const before = JSON.stringify(room.actors);
  for (const text of [undefined, null, 7, {}, "", "   ", "字".repeat(241)]) {
    assert.equal(room.command({ action: "say", text }, 100).ok, false);
    assert.equal(room.snapshot().speech, null);
    assert.equal(room.revision, 0);
  }
  assert.equal(room.command({ action: "say", actor: "yueyue", text: "hello" }, 100).ok, false);
  assert.equal(room.command({ action: "say", revision: -1, text: "hello" }, 100).ok, false);
  const result = room.command({ action: "say", text: "  牵好月月♡  " }, 100);
  assert.equal(result.status, "displayed");
  assert.equal(result.state.speech.text, "牵好月月♡");
  assert.equal(result.state.speech.actor, "yan");
  assert.equal(JSON.stringify(room.actors), before);
  assert.equal(room.following, false);
});

test("speech replaces, expires and never restores from a position save", () => {
  const room = new Room();
  room.command({ action: "say", text: "<b>这是纯文字</b>" }, 100);
  assert.equal(room.snapshot().speech.text, "<b>这是纯文字</b>");
  room.command({ action: "say", text: "♡".repeat(240) }, 200);
  const speech = room.snapshot().speech;
  speech.text = "outside mutation";
  assert.equal(room.snapshot().speech.text, "♡".repeat(240));
  room.advance(0, 24199);
  assert.ok(room.snapshot().speech);
  room.advance(0, 24200);
  assert.equal(room.snapshot().speech, null);
  room.command({ action: "say", text: "新的一句" }, 30000);
  assert.equal(new Room(room.actors).snapshot().speech, null);
  assert.equal(room.speech.clear(), true);
  assert.equal(room.speech.clear(), false);
});

test("speech leaves sitting, movement and follow consent independent", () => {
  const room = new Room();
  room.sit("yan", 1);
  settle(room);
  const before = room.snapshot().actors;
  room.command({ action: "say", text: "一起坐♡" }, 100);
  assert.deepEqual(room.snapshot().actors, before);
  const invite = room.command({ action: "invite_follow" }, 200);
  room.command({ action: "say", text: "等月月决定" }, 300);
  assert.equal(room.following, false);
  assert.equal(room.invitation.id, invite.requestId);
  room.command({ action: "move", u: .75, v: .7 }, 400);
  settle(room);
  assert.equal(room.snapshot().speech.text, "等月月决定");
  assert.equal(room.snapshot().actors.yan.posture, "standing");
});

test("two-person saves restore unchanged and give Yu his own standing position", () => {
  const saved = { yueyue: { u: .74, v: .7, seat: null }, yan: { u: .7, v: .6, seat: 1 } };
  const room = new Room(saved);
  assert.equal(room.actors.yueyue.u, .74);
  assert.equal(room.actors.yueyue.v, .7);
  assert.equal(room.actors.yan.seat, 1);
  assert.deepEqual({ u: room.actors.yan.u, v: room.actors.yan.v }, geometry.seats[1].approach);
  assert.equal(room.actors.yu.seat, null);
  assert.equal(geometry.walkable(room.actors.yu), true);
  assert.equal(room.actors.yu.path.length, 0);
});
test("three people reserve different seats; Yu cannot displace the original pair", () => {
  const room = new Room();
  room.sit("yueyue", 0); room.sit("yan", 1);
  assert.equal(room.command({ action: "sit", seat: 1 }, 10, "yu").ok, false);
  assert.equal(room.command({ action: "sit", seat: 2 }, 10, "yu").ok, true);
  assert.deepEqual([0, 1, 2].map(seat => room.occupant(seat)), ["yueyue", "yan", "yu"]);
  settle(room);
  assert.ok(geometry.seatedPair(room.snapshot().actors));
  for (const actor of Object.values(room.snapshot().actors)) assert.equal(actor.posture, "sitting");
  const yuBefore = room.snapshot().actors.yu;
  room.stand("yan");
  assert.deepEqual(room.snapshot().actors.yu, yuBefore);
  room.command({ action: "stand" }, 20, "yu");
  assert.equal(room.occupant(2), null);
});
test("Yu shares furniture routing but his bound interface cannot control either other person", () => {
  const room = new Room();
  const original = { yueyue: room.snapshot().actors.yueyue, yan: room.snapshot().actors.yan };
  assert.equal(room.command({ action: "move", actor: "yu", u: .7, v: .3 }).ok, false);
  for (const actor of ["yueyue", "yan"]) assert.equal(room.command({ action: "move", actor, u: .7, v: .3 }, 10, "yu").ok, false);
  assert.equal(room.command({ action: "move", u: .4, v: .5 }, 10, "yu").ok, false);
  assert.equal(room.command({ action: "move", u: .29, v: .47 }, 10, "yu").ok, true);
  settle(room);
  assert.ok(geometry.distance(room.actors.yu, { u: .29, v: .47 }) < .0001);
  assert.deepEqual(room.snapshot().actors.yueyue, original.yueyue);
  assert.deepEqual(room.snapshot().actors.yan, original.yan);
  assert.equal(room.command({ action: "stand", revision: -1 }, 10, "yu").ok, false);
});
test("Yu cannot start or cancel Yan's existing follow consent", () => {
  const room = new Room();
  const invitation = room.command({ action: "invite_follow" }, 10);
  assert.equal(room.command({ action: "invite_follow" }, 20, "yu").ok, false);
  assert.equal(room.command({ action: "stop_follow" }, 20, "yu").ok, false);
  assert.equal(room.invitation.id, invitation.requestId);
  assert.equal(room.following, false);
  room.respond(invitation.requestId, true, 21);
  const before = room.snapshot().actors.yueyue;
  room.command({ action: "move", u: .7, v: .7 }, 22, "yu");
  assert.deepEqual(room.snapshot().actors.yueyue, before);
  assert.equal(room.following, true);
});
test("Yu and Yan have independent plain-text speech and expiry without position mutations", () => {
  const room = new Room();
  const actors = JSON.stringify(room.actors);
  room.command({ action: "say", text: "Yan's own line" }, 100);
  room.command({ action: "say", text: "<b>Yu's own line</b>" }, 1000, "yu");
  let state = room.snapshot();
  assert.equal(state.speech.actor, "yan");
  assert.equal(state.speeches.yan.text, "Yan's own line");
  assert.equal(state.speeches.yu.actor, "yu");
  assert.equal(state.speeches.yu.text, "<b>Yu's own line</b>");
  room.advance(0, 12100);
  assert.equal(room.snapshot().speeches.yan, null);
  assert.ok(room.snapshot().speeches.yu);
  room.speeches.yu.clear();
  assert.equal(room.snapshot().speeches.yu, null);
  assert.equal(JSON.stringify(room.actors), actors);
});
