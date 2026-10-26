const test = require("node:test");
const assert = require("node:assert/strict");
const Room = require("./living-room-state.js");
function positions(room) {
  return Object.fromEntries(Object.entries(room.actors).map(([id, actor]) => [id, [actor.u, actor.v, actor.seat, JSON.stringify(actor.path)]]));
}
function settle(room) {
  for (let i = 0; i < 200; i++) room.advance(.1, 1000);
  assert.ok(Object.values(room.actors).every(actor => !actor.path.length));
}
test("solo reading stands by the bookshelf without moving companions", () => {
  const room = new Room();
  const before = positions(room);
  assert.equal(room.reading.userStart("alone").ok, true);
  settle(room);
  assert.deepEqual(positions(room).yan, before.yan);
  assert.deepEqual(positions(room).yu, before.yu);
  assert.equal(room.snapshot().actors.yueyue.posture, "standing");
  assert.equal(room.actors.yueyue.seat, null);
  assert.ok(room.actors.yueyue.u < .5 && room.actors.yueyue.v < .4);
  assert.equal(room.reading.session.reader, "yueyue");
});
for (const actor of ["yan", "yu"]) {
  const other = actor === "yan" ? "yu" : "yan";
  test(`inviting ${actor} waits for that actor's consent without moving anyone`, () => {
    const room = new Room();
    const before = positions(room);
    const request = room.reading.userStart("invite", actor, 1000);
    assert.equal(request.status, "awaiting_response");
    assert.deepEqual(positions(room), before);
    assert.equal(room.reading.session, null);
    assert.equal(room.command({ action: "accept_read", requestId: request.requestId }, 1001, other).ok, false);
    assert.equal(room.command({ action: "accept_read", requestId: "wrong" }, 1001, actor).ok, false);
    assert.equal(room.command({ action: "accept_read", requestId: request.requestId }, 1001, actor).ok, true);
    settle(room);
    assert.equal(room.reading.session.reader, "yueyue");
    assert.deepEqual(room.reading.session.participants, ["yueyue", actor]);
    assert.deepEqual(positions(room)[other], before[other]);
    assert.equal(room.reading.line("yueyue", "A quiet story", 1002).ok, true);
    assert.equal(room.snapshot().speeches.yueyue.text, "A quiet story");
    assert.equal(room.command({ action: "read_line", text: "Impersonating Yueyue" }, 1002, actor).ok, false);
  });
  test(`asking ${actor} starts immediately with no invitation or extra command`, () => {
    const room = new Room();
    assert.equal(room.reading.userStart("ask", actor).ok, true);
    assert.equal(room.reading.invitation, null);
    assert.equal(room.reading.session.reader, actor);
    assert.equal(room.command({ action: "read_line", text: "Early" }, 1000, actor).ok, false);
    settle(room);
    for (const id of ["yueyue", actor]) assert.equal(room.snapshot().actors[id].posture, "standing");
    assert.equal(room.command({ action: "read_line", text: "Story" }, 1001, other).ok, false);
    assert.equal(room.command({ action: "read_line", text: "Story" }, 1001, actor).ok, true);
    assert.equal(room.snapshot().speeches[actor].text, "Story");
  });
  test(`${actor} can read alone and invite Yueyue, but cannot approve for her`, () => {
    const room = new Room();
    const before = positions(room).yueyue;
    assert.equal(room.command({ action: "read_aloud" }, 1000, actor).ok, true);
    const request = room.command({ action: "invite_read" }, 1001, actor);
    assert.equal(request.ok, true);
    assert.deepEqual(positions(room).yueyue, before);
    assert.equal(room.command({ action: "accept_read", requestId: request.requestId }, 1002, actor).ok, false);
    assert.equal(room.reading.respond("yueyue", request.requestId, true, 1002).ok, true);
    settle(room);
    assert.equal(room.reading.session.reader, actor);
  });
  test(`${actor} can decline Yueyue without moving anyone; old answers cannot replay`, () => {
    const room = new Room();
    const before = positions(room);
    const request = room.reading.userStart("invite", actor, 1000);
    assert.equal(room.command({ action: "decline_read", requestId: request.requestId }, 1001, actor).ok, true);
    assert.deepEqual(positions(room), before);
    assert.equal(room.command({ action: "accept_read", requestId: request.requestId }, 1002, actor).ok, false);
  });
}
test("expiry keeps the recipient in place and rejects late acceptance", () => {
  const room = new Room();
  const before = positions(room);
  const request = room.reading.userStart("invite", "yan", 1000);
  assert.equal(room.command({ action: "accept_read", requestId: request.requestId }, 121000).ok, false);
  room.advance(0, 121000);
  assert.equal(room.reading.invitation, null);
  assert.deepEqual(positions(room), before);
});
test("unreachable participant fails atomically without losing the current session", () => {
  const room = new Room();
  room.reading.userStart("alone");
  settle(room);
  Object.assign(room.actors.yu, { u: -1, v: -1 });
  const before = room.snapshot();
  assert.equal(room.reading.userStart("ask", "yu").ok, false);
  assert.deepEqual(room.snapshot(), before);
});
test("an occupied shelf spot uses another spot without displacing an outsider", () => {
  const room = new Room({ yu: { u: .27, v: .18, seat: null } });
  const before = positions(room).yu;
  assert.equal(room.reading.userStart("ask", "yan").ok, true);
  settle(room);
  assert.deepEqual(positions(room).yu, before);
  assert.notDeepEqual(positions(room).yueyue.slice(0, 2), before.slice(0, 2));
});
test("switching reading partners leaves the previous reader in place without overlapping the new pair", () => {
  const room = new Room();
  room.reading.userStart("ask", "yan");
  settle(room);
  room.reading.end();
  const before = positions(room).yan;
  assert.equal(room.reading.userStart("ask", "yu").ok, true);
  settle(room);
  assert.deepEqual(positions(room).yan, before);
  const actors = room.snapshot().actors;
  const pairCenter = (actors.yueyue.screen.x + actors.yu.screen.x) / 2;
  assert.ok(Math.abs(pairCenter - actors.yan.screen.x) > 160);
});
test("standing, moving or sitting ends reading and clears its line", () => {
  for (const action of [room => room.stand("yan"), room => room.move("yueyue", { u: .7, v: .7 }), room => room.sit("yan", 0)]) {
    const room = new Room();
    room.reading.userStart("ask", "yan");
    settle(room);
    room.command({ action: "read_line", text: "Story" }, 1000);
    assert.equal(action(room).ok, true);
    assert.equal(room.reading.session, null);
    assert.equal(room.speech.snapshot(), null);
  }
});
test("outsiders cannot end reading, replace an invitation or impersonate the user", () => {
  const room = new Room();
  room.reading.userStart("alone");
  assert.equal(room.command({ action: "end_read" }, 1000, "yu").ok, false);
  assert.equal(room.command({ action: "invite_read" }, 1000, "yu").ok, false);
  assert.equal(room.command({ action: "invite_follow" }, 1000).ok, false);
  assert.equal(room.command({ action: "read_line", actor: "yueyue", text: "No" }, 1000).ok, false);
});
test("refresh drops reading and pending consent; returned snapshots cannot mutate membership", () => {
  const room = new Room();
  room.reading.userStart("ask", "yan");
  room.snapshot().reading.session.participants.pop();
  assert.equal(room.reading.session.participants.length, 2);
  const restored = new Room(room.actors);
  assert.equal(restored.reading.session, null);
  assert.equal(restored.reading.invitation, null);
});
test("invalid modes and stale revisions cannot start reading", () => {
  const room = new Room();
  assert.equal(room.command({ action: "invite_read", revision: -1 }, 1000).ok, false);
  assert.equal(room.reading.userStart("ask", "both").ok, false);
  assert.equal(room.reading.userStart("unknown", "yan").ok, false);
  assert.equal(room.reading.session, null);
});
