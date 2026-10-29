(function (root) {
  "use strict";
  const geometry = typeof module === "object" && module.exports ? require("./bedroom-geometry.js") : root.BedroomGeometry;
  class BedroomRest {
    constructor(room) { this.room = room; this.participants = []; this.invitation = null; this.serial = 0; }
    snapshot() { return { participants: [...this.participants], invitation: this.invitation ? { ...this.invitation } : null }; }
    begin(participants) {
      const routes = participants.map(id => [id, geometry.findPath(this.room.actors[id], geometry.bedside[id])]);
      if (routes.some(([, path]) => !path)) return { ok: false, error: "Everyone needs a clear route to the bed." };
      this.room.wake();
      this.participants = [...participants];
      for (const [id, path] of routes) this.room.actors[id].path = path;
      this.room.settling = true;
      this.room.revision++;
      return { ok: true, status: "started" };
    }
    invite(target, now = Date.now()) {
      if (!["yan", "yu"].includes(target)) return { ok: false, error: "Choose Yan or Yu." };
      if (this.invitation || this.participants.length) return { ok: false, error: "Finish the current invitation or get up first." };
      this.invitation = { id: `rest-${++this.serial}`, from: "yueyue", to: target, expiresAt: now + 120000 };
      this.room.revision++;
      return { ok: true, status: "awaiting_response", requestId: this.invitation.id };
    }
    respond(actorId, requestId, accepted, now = Date.now()) {
      this.expire(now);
      if (!this.invitation || this.invitation.to !== actorId || this.invitation.id !== requestId) return { ok: false, error: "This invitation is not available to you." };
      if (accepted) return this.begin(["yueyue", actorId]);
      this.invitation = null;
      this.room.revision++;
      return { ok: true, status: "declined" };
    }
    clear() {
      for (const id of this.participants) this.room.actors[id].path = [];
      this.participants = [];
      this.invitation = null;
    }
    interrupt(id) {
      if (this.participants.includes(id) || this.invitation?.from === id || this.invitation?.to === id) this.room.wake();
    }
    expire(now) {
      if (this.invitation && now >= this.invitation.expiresAt) { this.invitation = null; this.room.revision++; }
    }
  }
  if (typeof module === "object" && module.exports) module.exports = BedroomRest;
  else root.BedroomRest = BedroomRest;
})(typeof window === "undefined" ? globalThis : window);
