(function (root) {
  "use strict";
  const geometry = typeof module === "object" && module.exports ? require("./bedroom-geometry.js") : root.BedroomGeometry;
  const Speech = typeof module === "object" && module.exports ? require("./living-room-speech.js") : root.LivingRoomSpeech;
  const Rest = typeof module === "object" && module.exports ? require("./bedroom-rest.js") : root.BedroomRest;
  class Bedroom {
    constructor(saved) {
      this.revision = 0;
      this.resting = false;
      this.settling = false;
      this.rest = new Rest(this);
      this.actors = {
        yueyue: { id: "yueyue", u: .58, v: .58 },
        yan: { id: "yan", u: .88, v: .73 },
        yu: { id: "yu", u: .47, v: .90 }
      };
      this.speeches = {};
      for (const [id, actor] of Object.entries(this.actors)) {
        if (geometry.walkable(saved?.[id])) Object.assign(actor, { u: saved[id].u, v: saved[id].v });
        Object.assign(actor, { path: [], facing: "left" });
        this.speeches[id] = new Speech(id);
      }
    }
    snapshot() {
      return {
        room: "bedroom", revision: this.revision, resting: this.resting, settling: this.settling,
        rest: this.rest.snapshot(),
        actors: Object.fromEntries(Object.entries(this.actors).map(([id, actor]) => [id, {
          id, u: actor.u, v: actor.v, facing: actor.facing,
          posture: this.resting && this.rest.participants.includes(id) ? "sleeping" : actor.path.length ? "walking" : "standing",
          target: actor.path.at(-1) ? { ...actor.path.at(-1) } : null,
          screen: this.resting && this.rest.participants.includes(id) ? { ...(this.rest.participants.length === 3 ? geometry.heads[id] : geometry.pairHeads[id === "yueyue" ? "yueyue" : "companion"]) } : geometry.project(actor)
        }])),
        speeches: Object.fromEntries(Object.entries(this.speeches).map(([id, speech]) => [id, speech.snapshot()]))
      };
    }
    positions() {
      return Object.fromEntries(Object.entries(this.actors).map(([id, actor]) => [id, { u: actor.u, v: actor.v }]));
    }
    wake() {
      if (!this.resting && !this.settling && !this.rest.invitation) return { ok: true, status: "standing" };
      this.resting = false;
      this.settling = false;
      this.rest.clear();
      this.revision++;
      return { ok: true, status: "awake" };
    }
    move(id, target) {
      if (!this.actors[id]) return { ok: false, error: "Choose a known resident." };
      const path = geometry.findPath(this.actors[id], target);
      if (!path) return { ok: false, error: "Choose a clear spot on the bedroom floor." };
      this.rest.interrupt(id);
      this.actors[id].path = path;
      this.revision++;
      return { ok: true, status: "started" };
    }
    stand(id) {
      if (!this.actors[id]) return { ok: false, error: "Choose a known resident." };
      this.rest.interrupt(id);
      this.actors[id].path = [];
      this.revision++;
      return { ok: true, status: "standing" };
    }
    restTogether() {
      return this.rest.begin(Object.keys(this.actors));
    }
    advance(seconds, now = Date.now()) {
      this.rest.expire(now);
      for (const speech of Object.values(this.speeches)) if (speech.expire(now)) this.revision++;
      for (const actor of Object.values(this.actors)) {
        let remaining = Math.max(0, Math.min(seconds, .1)) * .28;
        while (remaining > 0 && actor.path.length) {
          const target = actor.path[0];
          const length = geometry.distance(actor, target);
          actor.facing = geometry.project(target).x < geometry.project(actor).x ? "left" : "right";
          if (length <= remaining) {
            Object.assign(actor, target);
            actor.path.shift();
            remaining -= length;
            if (!actor.path.length) this.revision++;
          } else {
            actor.u += (target.u - actor.u) / length * remaining;
            actor.v += (target.v - actor.v) / length * remaining;
            remaining = 0;
          }
        }
      }
      if (this.settling && this.rest.participants.every(id => !this.actors[id].path.length)) {
        this.settling = false;
        this.resting = true;
        this.revision++;
      }
    }
    pause() {
      if (this.settling || this.rest.invitation) this.wake();
      for (const actor of Object.values(this.actors)) actor.path = [];
      for (const speech of Object.values(this.speeches)) speech.clear();
      this.revision++;
    }
    command(input, actorId = "yan", now = Date.now()) {
      if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "An action object is required." };
      if (!["yan", "yu"].includes(actorId) || (input.actor !== undefined && input.actor !== actorId)) return { ok: false, error: "Use your own character’s interface." };
      if (input.action === "observe") return { ok: true, state: this.snapshot() };
      if (input.revision !== undefined && input.revision !== this.revision) return { ok: false, error: "The bedroom has changed. Observe again." };
      let result;
      switch (input.action) {
        case "move": result = this.move(actorId, { u: input.u, v: input.v }); break;
        case "come": {
          const target = geometry.beside(this.actors.yueyue);
          result = target ? this.move(actorId, target) : { ok: false, error: "There is no clear spot nearby." };
          break;
        }
        case "stand": result = this.stand(actorId); break;
        case "wake": result = this.rest.participants.includes(actorId) ? this.wake() : { ok: false, error: "You are already up." }; break;
        case "accept_rest": result = this.rest.respond(actorId, input.requestId, true, now); break;
        case "decline_rest": result = this.rest.respond(actorId, input.requestId, false, now); break;
        case "say": result = this.speeches[actorId].say(input.text); if (result.ok) this.revision++; break;
        case "face":
          this.actors[actorId].facing = geometry.project(this.actors.yueyue).x < geometry.project(this.actors[actorId]).x ? "left" : "right";
          this.revision++;
          result = { ok: true, status: "completed" };
          break;
        default: return { ok: false, error: "Use observe, move, come, stand, wake, face, say, accept_rest, or decline_rest." };
      }
      return { ...result, state: this.snapshot() };
    }
  }
  if (typeof module === "object" && module.exports) module.exports = Bedroom;
  else root.BedroomState = Bedroom;
})(typeof window === "undefined" ? globalThis : window);
