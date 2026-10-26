(function (root) {
  "use strict";
  const geometry = typeof module === "object" && module.exports ? require("./living-room-geometry.js") : root.LivingRoomGeometry;
  const companions = ["yan", "yu"];
  class ReadingSession {
    constructor(room) {
      this.room = room;
      this.session = null;
      this.invitation = null;
    }
    snapshot() {
      return {
        session: this.session ? { ...this.session, participants: [...this.session.participants] } : null,
        invitation: this.invitation ? { ...this.invitation } : null
      };
    }
    begin(participants, reader = null) {
      if (!Array.isArray(participants) || !participants.length || new Set(participants).size !== participants.length ||
          participants.some(id => !this.room.actors[id]) || (reader && !participants.includes(reader))) {
        return { ok: false, error: "Choose who will read together." };
      }
      const used = new Set();
      const assignments = [];
      for (const id of participants) {
        const actor = this.room.actors[id];
        const seat = geometry.seats.find(item => item.id === actor.seat && !used.has(item.id)) ??
          geometry.seats.find(item => !used.has(item.id) && (!this.room.occupant(item.id) || participants.includes(this.room.occupant(item.id))));
        if (!seat) return { ok: false, error: "There are not enough free seats. Nobody has moved." };
        const path = geometry.findPath(actor, seat.approach);
        if (!path) return { ok: false, error: "A reading seat cannot be reached. Nobody has moved." };
        assignments.push({ id, seat: seat.id, path });
        used.add(seat.id);
      }
      this.end();
      this.room.stopFollow();
      assignments.forEach(({ id, seat, path }) => this.room.startWalk(id, geometry.seats[seat].approach, seat, path));
      this.session = { participants: [...participants], reader, line: "" };
      this.room.record(reader ? "Settling in for a story." : "Settling in with a book.");
      return { ok: true, status: "started" };
    }
    userStart(mode, selected) {
      if (mode === "alone") return this.begin(["yueyue"]);
      const targets = selected === "both" ? companions : [selected];
      if (targets.some(id => !companions.includes(id)) || !["together", "listen"].includes(mode) ||
          (mode === "listen" && targets.length !== 1)) return { ok: false, error: "Choose Yan or Yu." };
      return this.begin(["yueyue", ...targets], mode === "listen" ? selected : null);
    }
    invite(actorId, now) {
      if (this.invitation) return { ok: false, error: "A reading invitation is already waiting." };
      if (this.session && (this.session.reader !== actorId || this.session.participants.length !== 1)) {
        return { ok: false, error: "Finish the current reading first." };
      }
      if (this.room.invitation || this.room.following) return { ok: false, error: "Finish the follow invitation first." };
      this.invitation = { id: `read-${this.room.revision + 1}`, actorId, expiresAt: now + 120000 };
      this.room.record(`${actorId === "yan" ? "Yan" : "Yu"} invited Yueyue to listen.`);
      return { ok: true, status: "awaiting_user", requestId: this.invitation.id };
    }
    respond(requestId, accepted, now = Date.now()) {
      const invitation = this.invitation;
      if (!invitation || invitation.id !== requestId || now >= invitation.expiresAt) return { ok: false, error: "This reading invitation has ended." };
      this.invitation = null;
      if (accepted) {
        const result = this.begin(["yueyue", invitation.actorId], invitation.actorId);
        if (!result.ok) this.room.record(result.error);
        return result;
      }
      this.room.record("Yueyue chose to keep doing her own thing.");
      return { ok: true };
    }
    line(actorId, text, now = Date.now()) {
      if (!this.session || this.session.reader !== actorId) return { ok: false, error: "Only the current reader can read a line." };
      if (this.session.participants.some(id => this.room.actors[id].path.length)) return { ok: false, error: "Please wait until everyone is seated." };
      if (typeof text !== "string" || !text.trim() || text.trim().length > 240) return { ok: false, error: "Use a story line of 1–240 characters." };
      const result = this.room.speeches[actorId].say(text.trim(), now);
      if (result.ok) {
        this.session.line = text.trim();
        this.room.record(`${actorId === "yan" ? "Yan" : "Yu"} read a story line.`);
      }
      return result;
    }
    end() {
      if (!this.session && !this.invitation) return;
      if (this.session) {
        if (this.session.reader) this.room.speeches[this.session.reader].clear();
        for (const id of this.session.participants) {
          const actor = this.room.actors[id];
          if (actor.path.length) { actor.path = []; actor.seat = null; }
        }
      }
      this.session = null;
      this.invitation = null;
      this.room.record("The book is closed.");
    }
    interrupt(actorId) {
      if (this.session?.participants.includes(actorId) || this.invitation?.actorId === actorId) this.end();
    }
    expire(now) {
      if (this.invitation && now >= this.invitation.expiresAt) {
        this.invitation = null;
        this.room.record("The reading invitation has expired.");
      }
    }
    command(input, actorId, now) {
      switch (input.action) {
        case "read_aloud":
          if (this.session || this.invitation) return { ok: false, error: "Finish the current reading first." };
          return this.begin([actorId], actorId);
        case "invite_read": return this.invite(actorId, now);
        case "read_line": return this.line(actorId, input.text, now);
        case "end_read":
          if (!this.session?.participants.includes(actorId) && this.invitation?.actorId !== actorId) return { ok: false, error: "This is not your reading session." };
          this.end(); return { ok: true, status: "completed" };
        default: return null;
      }
    }
  }
  if (typeof module === "object" && module.exports) module.exports = ReadingSession;
  else root.ReadingSession = ReadingSession;
})(typeof window === "undefined" ? globalThis : window);
