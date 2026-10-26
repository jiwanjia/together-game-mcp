(function (root) {
  "use strict";
  function validPoint(point) {
    return Boolean(point) && Number.isFinite(point.u) && Number.isFinite(point.v) &&
      Math.abs(point.u) <= 1 && point.v >= 0 && point.v <= 1;
  }
  function halfWidth(v) { return .054 + .055 * v + .034 * Math.max(0, 1 - v / .13); }
  function project(point) { return { x: .5 + point.u * halfWidth(point.v), y: .54 + point.v * .42 }; }
  function unproject(point) {
    const v = (point.y - .54) / .42;
    return { u: (point.x - .5) / halfWidth(v), v };
  }
  function actorAt(u, v) { return { u, v, target: null, facing: "front" }; }
  class WeddingRoom {
    constructor(saved = null) {
      this.revision = 0;
      this.actors = { yueyue: actorAt(-.48, .88), yan: actorAt(.48, .92) };
      this.drafts = { yueyue: "", yan: "月月，我愿意认真听你说话，和你一起照顾我们的小家。开心时陪你笑，难过时也好好回应你；有分歧时，仍愿意一起把话说清楚。今天，我想牵着你的手，走向我们愿意一起创造的每一天。" };
      this.completed = null;
      this.ceremony = null;
      this.following = false;
      if (!saved) return;
      for (const id of Object.keys(this.actors)) {
        if (validPoint(saved.actors?.[id])) Object.assign(this.actors[id], saved.actors[id], { target: null });
        if (typeof saved.drafts?.[id] === "string") this.drafts[id] = saved.drafts[id];
      }
      if (saved.completed) this.completed = { ...saved.completed };
    }
    ready() { return Object.values(this.actors).every(actor => actor.v <= .065 && !actor.target); }
    move(id, point) {
      if (!Object.hasOwn(this.actors, id) || !validPoint(point)) return { ok: false, error: "Choose a spot on the center aisle." };
      if (this.ceremony) return { ok: false, error: "Close the vows before walking." };
      if (id === "yan") this.following = false;
      const actor = this.actors[id];
      actor.target = { u: point.u, v: point.v };
      actor.facing = point.v < actor.v ? "back" : "front";
      this.revision++;
      return { ok: true, status: "walking" };
    }
    advance(seconds) {
      const elapsed = Math.min(.1, Math.max(0, seconds));
      let changed = false;
      for (const [id, actor] of Object.entries(this.actors)) {
        if (id === "yan" && this.following) this.updateFollower();
        if (!actor.target) continue;
        const du = actor.target.u - actor.u;
        const dv = actor.target.v - actor.v;
        const distance = Math.hypot(du * .15, dv * .42);
        const fraction = distance ? Math.min(1, elapsed * .11 / distance) : 1;
        actor.u += du * fraction;
        actor.v += dv * fraction;
        if (fraction === 1) { Object.assign(actor, actor.target); actor.target = null; actor.facing = "front"; }
        changed = true;
      }
      if (changed) this.revision++;
      return changed;
    }
    updateFollower() {
      const leader = this.actors.yueyue;
      const actor = this.actors.yan;
      const target = { u: leader.u > 0 ? -.5 : .5, v: Math.min(1, leader.v + (leader.target ? .06 : 0)) };
      if (Math.hypot((target.u - actor.u) * .15, (target.v - actor.v) * .42) <= .002) {
        actor.target = null;
        return;
      }
      actor.target = target;
      actor.facing = target.v < actor.v ? "back" : "front";
    }
    follow() {
      if (this.ceremony) return { ok: false, error: "Close the vows before following." };
      this.following = true;
      this.updateFollower();
      this.revision++;
      return { ok: true, status: "following" };
    }
    stopFollow() {
      this.following = false;
      this.actors.yan.target = null;
      this.revision++;
      return { ok: true, status: "stopped" };
    }
    pause() {
      this.following = false;
      for (const actor of Object.values(this.actors)) actor.target = null;
      this.ceremony = null;
      this.revision++;
    }
    draft(id, text) {
      if (!Object.hasOwn(this.drafts, id) || typeof text !== "string" || Array.from(text).length > 1200) return false;
      this.drafts[id] = text;
      this.revision++;
      return true;
    }
    begin(replay = false) {
      if (this.ceremony || !this.ready()) return { ok: false, error: "Both of you need to reach the front first." };
      if (replay && !this.completed) return { ok: false, error: "There are no completed vows to replay yet." };
      this.following = false;
      this.ceremony = { step: 0, replay, vows: { ...(replay ? this.completed.vows : this.drafts) } };
      this.revision++;
      return { ok: true };
    }
    next() {
      if (!this.ceremony) return { ok: false, error: "Start the vows first." };
      if (this.ceremony.step < 3) this.ceremony.step++;
      else {
        if (!this.ceremony.replay) this.completed = { at: new Date().toISOString(), vows: { ...this.ceremony.vows } };
        this.ceremony = null;
      }
      this.revision++;
      return { ok: true };
    }
    snapshot() {
      return JSON.parse(JSON.stringify({ revision: this.revision, actors: this.actors, drafts: this.drafts,
        completed: this.completed, ceremony: this.ceremony, following: this.following, ready: this.ready() }));
    }
    record() {
      return { version: 1, actors: Object.fromEntries(Object.entries(this.actors).map(([id, actor]) =>
        [id, { u: actor.u, v: actor.v, facing: actor.facing }])), drafts: { ...this.drafts }, completed: this.completed };
    }
    command(input) {
      if (!input || typeof input !== "object") return { ok: false, error: "An action is required." };
      if (input.revision !== undefined && input.revision !== this.revision) return { ok: false, error: "The room has changed. Observe again." };
      if (input.actor !== undefined && input.actor !== "yan") return { ok: false, error: "Only Yan can be controlled through this interface." };
      let result;
      if (input.action === "observe") result = { ok: true };
      else if (input.action === "move") result = this.move("yan", input);
      else if (input.action === "come") result = this.move("yan", { u: this.actors.yueyue.u > 0 ? -.5 : .5, v: this.actors.yueyue.v });
      else if (input.action === "stop_follow") result = this.stopFollow();
      else if (input.action === "face" && !this.ceremony && ["front", "back", "yueyue"].includes(input.direction)) {
        this.stopFollow();
        this.actors.yan.facing = input.direction === "yueyue" ? (this.actors.yueyue.v < this.actors.yan.v ? "back" : "front") : input.direction;
        this.revision++;
        result = { ok: true };
      } else result = { ok: false, error: "This action is unavailable." };
      return { ...result, state: this.snapshot() };
    }
  }
  const api = { WeddingRoom, validPoint, project, unproject };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeddingRoomState = api;
})(typeof window === "undefined" ? globalThis : window);
