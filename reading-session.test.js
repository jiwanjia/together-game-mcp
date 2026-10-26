const test = require("node:test");
const assert = require("node:assert/strict");
const Room = require("./living-room-state.js");

function position(room, id) {
  const actor = room.actors[id];
  return { u: actor.u, v: actor.v, seat: actor.seat, path: JSON.stringify(actor.path) };
}
function settle(room) {
  for (let i = 0; i < 200; i++) room.advance(.1, 1000);
  assert.ok(Object.values(room.actors).every(actor => actor.path.length === 0));
}
test("reading alone preserves both companions", () => {
  const room = new Room();
  const before = [position(room, "yan"), position(room, "yu")];
  assert.equal(room.reading.userStart("alone").ok, true);
  settle(room);
  assert.deepEqual([position(room, "yan"), position(room, "yu")], before);
  assert.deepEqual(room.snapshot().reading.session.participants, ["yueyue"]);
});
for (const target of ["yan", "yu", "both"]) {
  test(`inviting ${target} reserves distinct seats and leaves outsiders alone`, () => {
    const room = new Room();
    const outsider = target === "both" ? null : target === "yan" ? "yu" : "yan";
    const before = outsider && position(room, outsider);
    assert.equal(room.reading.userStart("together", target).ok, true);
    settle(room);
    const session = room.snapshot().reading.session;
    assert.equal(new Set(session.participants.map(id => room.actors[id].seat)).size, session.participants.length);
    if (outsider) assert.deepEqual(position(room, outsider), before);
  });
}
for (const reader of ["yan", "yu"]) {
  test(`${reader} reads only after sitting; another actor cannot supply the line`, () => {
    const room = new Room();
    assert.equal(room.reading.userStart("listen", reader).ok, true);
    assert.equal(room.command({ action: "read_line", text: "Hello" }, 1000, reader).ok, false);
    settle(room);
    const other = reader === "yan" ? "yu" : "yan";
    assert.equal(room.command({ action: "read_line", text: "Hello" }, 1000, other).ok, false);
    assert.equal(room.command({ action: "read_line", text: "Hello" }, 1000, reader).ok, true);
    assert.equal(room.snapshot().speeches[reader].text, "Hello");
    assert.equal(room.command({ action: "read_line", text: " " }, 1000, reader).ok, false);
    assert.equal(room.command({ action: "read_line", text: "x".repeat(241) }, 1000, reader).ok, false);
  });
  test(`${reader} can read alone, then invite without moving Yueyue`, () => {
    const room = new Room();
    const before = position(room, "yueyue");
    assert.equal(room.command({ action: "read_aloud" }, 1000, reader).ok, true);
    assert.equal(room.command({ action: "invite_read" }, 1000, reader).status, "awaiting_user");
    assert.deepEqual(position(room, "yueyue"), before);
    assert.equal(room.reading.respond(room.reading.invitation.id, true, 1001).ok, true);
    settle(room);
    assert.deepEqual(room.reading.session.participants, ["yueyue", reader]);
  });
}
test("declining or expiring never moves Yueyue; stale answers fail", () => {
  const room = new Room();
  const before = position(room, "yueyue");
  room.command({ action: "invite_read" }, 1000, "yu");
  const id = room.reading.invitation.id;
  assert.equal(room.reading.respond(id, false, 1001).ok, true);
  assert.equal(room.reading.respond(id, true, 1002).ok, false);
  room.command({ action: "invite_read" }, 1003, "yan");
  room.advance(0, 121003);
  assert.equal(room.reading.invitation, null);
  assert.deepEqual(position(room, "yueyue"), before);
});
test("an outsider occupying a seat stays put", () => {
  const room = new Room({ yu: { u: .29, v: .39, seat: 0 } });
  const before = position(room, "yu");
  assert.equal(room.reading.userStart("listen", "yan").ok, true);
  settle(room);
  assert.deepEqual(position(room, "yu"), before);
  assert.equal(room.actors.yueyue.seat, 1);
  assert.equal(room.actors.yan.seat, 2);
});
test("an unreachable participant causes no partial move or lost session", () => {
  const room = new Room();
  room.reading.userStart("alone");
  settle(room);
  Object.assign(room.actors.yu, { u: -1, v: -1 });
  const before = room.snapshot();
  assert.equal(room.reading.userStart("together", "both").ok, false);
  assert.deepEqual(room.snapshot(), before);
});
test("standing, walking, or choosing another seat closes the book", () => {
  for (const action of [room => room.stand("yan"), room => room.move("yueyue", { u: .7, v: .7 }), room => room.sit("yan", room.actors.yan.seat)]) {
    const room = new Room();
    room.reading.userStart("listen", "yan");
    settle(room);
    room.command({ action: "read_line", text: "Story" }, 1000);
    assert.equal(action(room).ok, true);
    assert.equal(room.reading.session, null);
    assert.equal(room.speech.snapshot(), null);
  }
});
test("an unrelated companion cannot end the session or replace its invitation", () => {
  const room = new Room();
  room.reading.userStart("alone");
  assert.equal(room.command({ action: "end_read" }, 1000, "yu").ok, false);
  assert.equal(room.command({ action: "invite_read" }, 1000, "yu").ok, false);
  assert.equal(room.command({ action: "invite_follow" }, 1000).ok, false);
});
test("reading state snapshots are isolated and refresh does not restore a session", () => {
  const room = new Room();
  room.reading.userStart("together", "both");
  room.snapshot().reading.session.participants.pop();
  assert.equal(room.reading.session.participants.length, 3);
  assert.equal(new Room(room.actors).reading.session, null);
});
test("actor spoofing, stale revisions and invalid target selection are rejected", () => {
  const room = new Room();
  assert.equal(room.command({ action: "invite_read", actor: "yu" }, 1000).ok, false);
  assert.equal(room.command({ action: "invite_read", revision: -1 }, 1000).ok, false);
  assert.equal(room.reading.userStart("listen", "both").ok, false);
  assert.equal(room.reading.userStart("together", "unknown").ok, false);
  assert.equal(room.reading.session, null);
});
