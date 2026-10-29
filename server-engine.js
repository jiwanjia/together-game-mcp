"use strict";
// Run the existing game rules once inside the caller's database transaction.
const Room = require("./living-room-state.js");
const allowed = new Set(["observe", "move", "come", "sit", "stand", "face", "say",
  "read_aloud", "invite_read", "accept_read", "decline_read", "read_line", "end_read"]);

function restore(data) {
  const room = new Room();
  if (!data) return room;
  for (const field of ["actors", "revision", "following", "invitation", "requests", "events"]) {
    if (data[field] !== undefined) room[field] = data[field];
  }
  for (const id of ["yueyue", "yan", "yu"]) room.speeches[id].current = data.speeches?.[id] || null;
  if (data.reading) {
    room.reading.session = data.reading.session;
    room.reading.invitation = data.reading.invitation;
  }
  return room;
}

function execute(input) {
  const now = Date.now();
  const room = restore(input.state);
  const elapsed = Math.max(0, Math.min(60, (now - (input.updatedAt || now)) / 1000));
  for (let left = elapsed; left > 0; left -= .1) room.advance(Math.min(.1, left), now);
  const command = input.command || { action: "observe" };
  let result;
  if (command.action !== "observe" && command.revision !== undefined && command.revision !== room.revision) {
    result = { ok: false, error: "The room has changed. Observe again." };
  } else if (!allowed.has(command.action) && !input.user) {
    result = { ok: false, error: "This action is unavailable to companions." };
  } else if (input.user) {
    const actor = command.actor || "yueyue";
    if (!["yueyue", "yan", "yu"].includes(actor)) throw new Error("Unknown character.");
    switch (command.action) {
      case "observe": result = { ok: true }; break;
      case "move": result = room.move(actor, command); break;
      case "sit": result = room.sit(actor, command.seat); break;
      case "stand": result = room.stand(actor); break;
      case "invite": room.inviteFromUser(command.kind); result = { ok: true }; break;
      case "respond": result = room.respond(command.requestId, command.accepted === true, now); break;
      case "stop_follow": room.stopFollow(); result = { ok: true }; break;
      case "reading_start": result = room.reading.userStart(command.mode, command.selected, now); break;
      case "reading_respond": result = room.reading.respond("yueyue", command.requestId, command.accepted === true, now); break;
      case "reading_line": result = room.reading.line(room.reading.session?.reader, command.text, now); break;
      case "reading_end": room.reading.end(); result = { ok: true }; break;
      case "close_speech": room.speeches[actor]?.clear(); room.revision++; result = { ok: true }; break;
      default: result = room.command(command, now, actor); break;
    }
  } else {
    if (!["yan", "yu"].includes(input.actor)) throw new Error("A trusted companion identity is required.");
    result = room.command(command, now, input.actor);
  }
  const state = {
    actors: room.actors, revision: room.revision, following: room.following,
    invitation: room.invitation, requests: room.requests, events: room.events,
    speeches: Object.fromEntries(Object.entries(room.speeches).map(([id, speech]) => [id, speech.snapshot()])),
    reading: room.reading.snapshot()
  };
  return { ...result, state: room.snapshot(), transport: state, updatedAt: now };
}

if (require.main === module) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => { raw += chunk; if (raw.length > 100000) process.exit(2); });
  process.stdin.on("end", () => {
    try { process.stdout.write(JSON.stringify(execute(JSON.parse(raw)))); }
    catch (error) { process.stderr.write(error.message); process.exitCode = 1; }
  });
}
module.exports = { execute };
