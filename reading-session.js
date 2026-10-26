(function (root) {
  "use strict";
  const geometry = typeof module === "object" && module.exports ? require("./living-room-geometry.js") : root.LivingRoomGeometry;
  const companions = ["yan", "yu"];
  class ReadingSession {
    constructor(room) { this.room = room; this.session = null; this.invitation = null; }
    snapshot() {
      return {
        session: this.session ? { ...this.session, participants: [...this.session.participants] } : null,
        invitation: this.invitation ? { ...this.invitation } : null
      };
    }
    routes(participants) {
      const outsiders = Object.values(this.room.actors).filter(actor => !participants.includes(actor.id));
      const groups = participants.length === 1 ?
        [[{ u: .27, v: .18 }], [{ u: .215, v: .08 }], [{ u: .27, v: .07 }], [{ u: .27, v: .30 }], [{ u: .38, v: .07 }], [{ u: .50, v: .07 }]] : [
          [{ u: .27, v: .24 }, { u: .27, v: .40 }],
          [{ u: .57, v: .17 }, { u: .60, v: .33 }],
          [{ u: .70, v: .25 }, { u: .73, v: .41 }],
          [{ u: .40, v: .74 }, { u: .43, v: .90 }]
        ];
      for (const spots of groups) {
        const assignments = participants.map((id, index) => ({ id, target: spots[index] }));
        if (assignments.some(item => outsiders.some(actor => geometry.distance(actor, item.target) < .09))) continue;
        const screens = spots.map(geometry.project);
        const x = screens.reduce((sum, point) => sum + point.x, 0) / screens.length;
        const y = Math.max(...screens.map(point => point.y));
        const halfWidth = participants.length === 1 ? 60 : 105;
        // Keep the visible PNG clear of people left beside the previous reading spot.
        if (outsiders.some(actor => {
          const point = geometry.project(actor.seat === null ? actor : geometry.seats[actor.seat].foot);
          return x - halfWidth < point.x + 63 && x + halfWidth > point.x - 63 && y - 205 < point.y && y > point.y - 175;
        })) continue;
        for (const item of assignments) item.path = geometry.findPath(this.room.actors[item.id], item.target);
        if (assignments.every(item => item.path)) return assignments;
      }
      return null;
    }
    begin(participants, reader) {
      if (!Array.isArray(participants) || !participants.length || participants.length > 2 || new Set(participants).size !== participants.length ||
          participants.some(id => !this.room.actors[id]) || !participants.includes(reader)) return { ok: false, error: "Choose one reader and up to one companion." };
      const routes = this.routes(participants);
      if (!routes) return { ok: false, error: "The reading spot cannot be reached. Nobody has moved." };
      this.end();
      this.room.stopFollow();
      routes.forEach(({ id, target, path }) => this.room.startWalk(id, target, null, path));
      this.session = { participants: [...participants], reader, line: "" };
      this.room.record("Walking to the bookshelf.");
      return { ok: true, status: "started" };
    }
    userStart(mode, selected, now = Date.now()) {
      if (mode === "alone") return this.begin(["yueyue"], "yueyue");
      if (!companions.includes(selected)) return { ok: false, error: "Choose Yan or Yu." };
      if (mode === "invite") return this.invite("yueyue", selected, "yueyue", now);
      if (mode === "ask") return this.begin(["yueyue", selected], selected);
      return { ok: false, error: "Choose Read, Invite, or Ask." };
    }
    invite(from, to, reader, now) {
      if (this.invitation) return { ok: false, error: "A reading invitation is already waiting." };
      if (this.session && (this.session.reader !== from || this.session.participants.length !== 1)) return { ok: false, error: "Close the current book first." };
      if (this.room.invitation || this.room.following) return { ok: false, error: "Finish the follow invitation first." };
      this.invitation = { id: `read-${this.room.revision + 1}`, from, to, reader, expiresAt: now + 120000 };
      this.room.record(to === "yueyue" ? `${from === "yan" ? "Yan" : "Yu"} invited Yueyue to listen.` : `Waiting for ${to === "yan" ? "Yan" : "Yu"} to answer Yueyue’s invitation.`);
      return { ok: true, status: "awaiting_response", requestId: this.invitation.id };
    }
    respond(actorId, requestId, accepted, now = Date.now()) {
      const invitation = this.invitation;
      if (!invitation || invitation.to !== actorId || invitation.id !== requestId || now >= invitation.expiresAt) return { ok: false, error: "This invitation is not available to you." };
      this.invitation = null;
      if (accepted) {
        const companion = invitation.from === "yueyue" ? invitation.to : invitation.from;
        const result = this.begin(["yueyue", companion], invitation.reader);
        if (!result.ok) this.room.record(result.error);
        return result;
      }
      this.room.record("The invitation was declined. Everyone can keep doing their own thing.");
      return { ok: true, status: "declined" };
    }
    line(actorId, text, now = Date.now()) {
      if (!this.session || this.session.reader !== actorId) return { ok: false, error: "Only the current reader can read a line." };
      if (this.session.participants.some(id => this.room.actors[id].path.length)) return { ok: false, error: "Please wait until everyone reaches the bookshelf." };
      const result = this.room.speeches[actorId].say(text, now);
      if (result.ok) {
        this.session.line = text.trim();
        this.room.record(`${{ yueyue: "Yueyue", yan: "Yan", yu: "Yu" }[actorId]} read a story line.`);
      }
      return result;
    }
    end() {
      if (!this.session && !this.invitation) return;
      if (this.session) {
        this.room.speeches[this.session.reader].clear();
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
      if (this.session?.participants.includes(actorId) || this.invitation?.from === actorId || this.invitation?.to === actorId) this.end();
    }
    expire(now) {
      if (this.invitation && now >= this.invitation.expiresAt) { this.invitation = null; this.room.record("The reading invitation has expired."); }
    }
    command(input, actorId, now) {
      switch (input.action) {
        case "read_aloud":
          if (this.session || this.invitation) return { ok: false, error: "Close the current book first." };
          return this.begin([actorId], actorId);
        case "invite_read": return this.invite(actorId, "yueyue", actorId, now);
        case "accept_read": return this.respond(actorId, input.requestId, true, now);
        case "decline_read": return this.respond(actorId, input.requestId, false, now);
        case "read_line": return this.line(actorId, input.text, now);
        case "end_read":
          if (!this.session?.participants.includes(actorId) && this.invitation?.from !== actorId) return { ok: false, error: "This is not your reading session." };
          this.end(); return { ok: true, status: "completed" };
        default: return null;
      }
    }
  }
  if (typeof module === "object" && module.exports) module.exports = ReadingSession;
  else root.ReadingSession = ReadingSession;
})(typeof window === "undefined" ? globalThis : window);
