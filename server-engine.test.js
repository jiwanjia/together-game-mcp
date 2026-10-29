"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { execute } = require("./server-engine.js");

function call(previous, command, actor = "yan", user = false, elapsed = 0) {
  return execute({ state: previous?.transport, updatedAt: Date.now() - elapsed, command, actor, user });
}

test("shared reading invitations survive polls and only the recipient accepts", () => {
  const invited = call(null, { action: "reading_start", mode: "invite", selected: "yu" }, null, true);
  assert.equal(invited.status, "awaiting_response");
  const requestId = invited.transport.reading.invitation.id;
  const polled = call(invited, { action: "observe" });
  assert.equal(polled.transport.reading.invitation.id, requestId);
  const denied = call(polled, { action: "accept_read", requestId }, "yan");
  assert.equal(denied.ok, false);
  assert.deepEqual(denied.transport.actors, polled.transport.actors);
  const accepted = call(denied, { action: "accept_read", requestId }, "yu");
  assert.equal(accepted.ok, true);
  assert.deepEqual(accepted.transport.reading.session.participants, ["yueyue", "yu"]);
  const arrived = call(accepted, { action: "observe" }, "yan", false, 60000);
  const line = call(arrived, { action: "reading_line", text: "A quiet afternoon." }, null, true);
  assert.equal(line.ok, true);
  assert.equal(call(line, { action: "observe" }).transport.speeches.yueyue.text, "A quiet afternoon.");
});

test("old room records upgrade without changing actors and companion cannot approve Yueyue", () => {
  const original = call(null, { action: "observe" });
  delete original.transport.reading;
  delete original.transport.speeches.yueyue;
  const upgraded = call(original, { action: "observe" });
  assert.deepEqual(upgraded.transport.actors, original.transport.actors);
  assert.deepEqual(upgraded.transport.reading, { session: null, invitation: null });
  const invited = call(upgraded, { action: "invite_read" }, "yan");
  const requestId = invited.transport.reading.invitation.id;
  assert.equal(call(invited, { action: "accept_read", requestId }, "yan").ok, false);
  assert.equal(call(invited, { action: "reading_respond", requestId, accepted: true }, "yan").ok, false);
  assert.equal(call(invited, { action: "reading_respond", requestId, accepted: true }, null, true).ok, true);
});
