(function (root) {
  "use strict";
  const geometry = typeof module === "object" && module.exports ? require("./living-room-geometry.js") : root.LivingRoomGeometry;
  class Room {
    constructor(saved) {
      this.actors = {
        yueyue: { id: "yueyue", name: "月月", u: .66, v: .24, seat: null },
        yan: { id: "yan", name: "哥哥", u: .64, v: .33, seat: null }
      };
      this.revision = 0;
      this.following = false;
      this.invitation = null;
      this.requests = [];
      this.events = [];
      for (const actor of Object.values(this.actors)) {
        actor.path = [];
        actor.facing = "left";
        const record = saved?.[actor.id];
        if (record && geometry.walkable(record)) { actor.u = record.u; actor.v = record.v; }
        if (record && Number.isInteger(record.seat) && geometry.seats[record.seat] && this.occupant(record.seat) === null) {
          actor.seat = record.seat;
          Object.assign(actor, geometry.seats[record.seat].approach);
        }
      }
    }
    occupant(seat) { return Object.values(this.actors).find(actor => actor.seat === seat)?.id ?? null; }
    record(message) {
      this.revision++;
      this.events.push({ revision: this.revision, message });
      this.events = this.events.slice(-12);
    }
    snapshot() {
      return {
        room: "living-room", revision: this.revision, following: this.following,
        actors: Object.fromEntries(Object.entries(this.actors).map(([id, actor]) => [id, {
          id, name: actor.name, u: actor.u, v: actor.v, seat: actor.seat, facing: actor.facing,
          posture: actor.path.length ? "walking" : actor.seat === null ? "standing" : "sitting",
          target: actor.path.at(-1) ?? null,
          screen: geometry.project(actor.seat !== null && !actor.path.length ? geometry.seats[actor.seat].foot : actor)
        }])),
        seats: geometry.seats.map(seat => ({ ...seat, occupant: this.occupant(seat.id) })),
        invitation: this.invitation ? { ...this.invitation } : null,
        requests: this.requests.map(request => ({ ...request })), events: this.events.slice()
      };
    }
    startWalk(id, target, seat = null, preparedPath) {
      const actor = this.actors[id];
      const path = preparedPath ?? geometry.findPath(actor, target);
      if (!path) return false;
      actor.seat = seat;
      actor.path = path;
      return true;
    }
    move(id, target) {
      const path = geometry.findPath(this.actors[id], target);
      if (!path) return { ok: false, error: "这里走不到，请点地板上的空处。" };
      let followerTarget, followerPath;
      if (id === "yan" && this.following) {
        followerTarget = geometry.beside(target);
        followerPath = followerTarget && geometry.findPath(this.actors.yueyue, followerTarget);
        if (!followerPath) return { ok: false, error: "这里容不下两个人，请换一处空地。" };
      }
      if (id === "yueyue") this.stopFollow();
      this.startWalk(id, target, null, path);
      if (followerPath) this.startWalk("yueyue", followerTarget, null, followerPath);
      this.record(`${this.actors[id].name}开始走动。`);
      return { ok: true, status: "started" };
    }
    sit(id, seat) {
      if (!Number.isInteger(seat) || !geometry.seats[seat]) return { ok: false, error: "请选择左、中、右三个座位之一。" };
      if (this.occupant(seat) && this.occupant(seat) !== id) return { ok: false, error: "这个座位已经有人了。" };
      const assignments = [[id, seat]];
      if (id === "yan" && this.following) {
        const neighbor = geometry.seats.filter(item => item.id !== seat &&
          (!this.occupant(item.id) || this.occupant(item.id) === "yueyue"))
          .sort((a, b) => Math.abs(a.id - seat) - Math.abs(b.id - seat))[0];
        if (!neighbor) return { ok: false, error: "没有空的邻座可以一起坐。" };
        assignments.push(["yueyue", neighbor.id]);
      }
      const routes = assignments.map(([actor, index]) => geometry.findPath(this.actors[actor], geometry.seats[index].approach));
      if (routes.some(path => !path)) return { ok: false, error: "暂时走不到这个座位。" };
      if (id === "yueyue") this.stopFollow();
      assignments.forEach(([actor, index], cursor) => this.startWalk(actor, geometry.seats[index].approach, index, routes[cursor]));
      this.record(`${this.actors[id].name}准备坐到${geometry.seats[seat].name}。`);
      return { ok: true, status: "started" };
    }
    stand(id) {
      const actor = this.actors[id];
      actor.seat = null;
      actor.path = [];
      if (id === "yueyue") this.stopFollow();
      if (id === "yan" && this.following) { this.actors.yueyue.seat = null; this.actors.yueyue.path = []; }
      this.record(`${actor.name}站好了。`);
      return { ok: true, status: "completed" };
    }
    stopFollow() {
      if (!this.following && !this.invitation) return;
      this.following = false;
      this.invitation = null;
      this.actors.yueyue.path = [];
      if (this.actors.yueyue.seat !== null && geometry.distance(this.actors.yueyue,
        geometry.seats[this.actors.yueyue.seat].approach) > .01) this.actors.yueyue.seat = null;
      this.record("月月恢复自己操作。 ");
    }
    respond(requestId, accepted, now = Date.now()) {
      if (!this.invitation || this.invitation.id !== requestId || now >= this.invitation.expiresAt) return { ok: false, error: "这份邀请已结束。" };
      this.invitation = null;
      this.following = accepted;
      this.record(accepted ? "月月同意跟着哥哥。" : "月月这次想自己玩。 ");
      if (accepted) {
        const leader = this.actors.yan;
        const result = leader.seat !== null ? this.sit("yan", leader.seat) : this.move("yan", leader.path.at(-1) ?? { u: leader.u, v: leader.v });
        if (!result.ok) { this.following = false; this.record(result.error); return result; }
      }
      return { ok: true };
    }
    inviteFromUser(action) {
      this.requests.push({ id: `request-${this.revision + 1}`, action, status: "pending" });
      this.requests = this.requests.slice(-8);
      this.record(action === "come" ? "月月邀请哥哥过来陪她。" : "月月邀请哥哥一起坐。 ");
    }
    command(input, now = Date.now()) {
      if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "动作参数必须是对象。" };
      if (input.actor !== undefined && input.actor !== "yan") return { ok: false, error: "哥哥的工具只能操作哥哥。" };
      if (input.action === "observe") return { ok: true, state: this.snapshot() };
      if (input.revision !== undefined && input.revision !== this.revision) return { ok: false, error: "房间已变化，请重新观察。" };
      let result;
      switch (input.action) {
        case "move": result = this.move("yan", { u: input.u, v: input.v }); break;
        case "come": {
          const target = geometry.beside(this.actors.yueyue);
          result = target ? this.move("yan", target) : { ok: false, error: "月月旁边没有空处。" };
          break;
        }
        case "sit": result = this.sit("yan", input.seat); break;
        case "stand": result = this.stand("yan"); break;
        case "face": {
          this.actors.yan.facing = geometry.project(this.actors.yueyue).x < geometry.project(this.actors.yan).x ? "left" : "right";
          this.record("哥哥转向月月。 "); result = { ok: true, status: "completed" }; break;
        }
        case "invite_follow": {
          if (this.invitation || this.following) return { ok: false, error: "已经有邀请或正在一起走。" };
          this.invitation = { id: `follow-${this.revision + 1}`, expiresAt: now + 120000 };
          this.record("哥哥邀请月月跟着一起玩。 ");
          result = { ok: true, status: "awaiting_user", requestId: this.invitation.id }; break;
        }
        case "stop_follow": this.stopFollow(); result = { ok: true, status: "completed" }; break;
        default: return { ok: false, error: "未知动作；可用observe/move/come/sit/stand/face/invite_follow/stop_follow。" };
      }
      if (result.ok && ["come", "sit"].includes(input.action)) {
        this.requests.filter(item => item.action === input.action).forEach(item => { item.status = "handled"; });
      }
      return { ...result, state: this.snapshot() };
    }
    advance(seconds, now = Date.now()) {
      if (this.invitation && now >= this.invitation.expiresAt) { this.invitation = null; this.record("邀请到时间了，月月继续自己玩。 "); }
      for (const actor of Object.values(this.actors)) {
        if (!actor.path.length) continue;
        let remaining = Math.max(0, Math.min(seconds, .1)) * .28;
        while (remaining > 0 && actor.path.length) {
          const target = actor.path[0];
          const length = geometry.distance(actor, target);
          actor.facing = geometry.project(target).x < geometry.project(actor).x ? "left" : "right";
          if (length <= remaining) {
            Object.assign(actor, target); actor.path.shift(); remaining -= length;
            if (!actor.path.length) this.record(`${actor.name}${actor.seat === null ? "走到了。" : "坐好了。"}`);
          } else {
            actor.u += (target.u - actor.u) / length * remaining;
            actor.v += (target.v - actor.v) / length * remaining;
            remaining = 0;
          }
        }
      }
    }
  }
  if (typeof module === "object" && module.exports) module.exports = Room;
  else root.LivingRoomState = Room;
})(typeof window === "undefined" ? globalThis : window);
