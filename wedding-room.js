(function () {
  "use strict";
  const geometry = window.WeddingRoomState;
  const storage = window.WeddingRoomStorage.forPage(window);
  const room = new geometry.WeddingRoom(storage.load());
  const floor = document.querySelector("#wedding-floor");
  const speech = new window.LivingRoomSpeech();
  const speechView = new window.LivingRoomSpeechView(floor, document.querySelector("#wedding-speech"),
    document.querySelector("#wedding-yan"), () => { speech.clear(); render(); });
  let active = false;
  let frame = 0;
  let lastTime = 0;
  let savedRevision = room.revision;
  let notice = "";
  const ceremony = new window.WeddingCeremony(room, () => { save(); render(); });
  const interactions = new window.WeddingInteractions(room, result => { save(); accept(result); });
  function save() {
    if (savedRevision === room.revision) return;
    storage.save(room.record());
    savedRevision = room.revision;
  }
  function render() {
    for (const [id, actor] of Object.entries(room.actors)) {
      const element = document.querySelector(`#wedding-${id}`);
      const point = geometry.project(actor);
      element.style.left = `${point.x * 100}%`;
      element.style.top = `${point.y * 100}%`;
      element.style.width = `${11 + actor.v * 8}%`;
      element.style.zIndex = Math.round(point.y * 1000);
      element.dataset.facing = actor.facing;
      element.dataset.walking = String(Boolean(actor.target));
    }
    const destination = document.querySelector("#wedding-destination");
    destination.hidden = !room.actors.yueyue.target;
    if (!destination.hidden) {
      const point = geometry.project(room.actors.yueyue.target);
      destination.style.left = `${point.x * 100}%`;
      destination.style.top = `${point.y * 100}%`;
    }
    document.querySelector("#wedding-begin").disabled = !room.ready() || Boolean(room.ceremony);
    document.querySelector("#wedding-replay").hidden = !room.completed;
    document.querySelector("#wedding-replay").disabled = !room.ready() || Boolean(room.ceremony);
    document.querySelector("#wedding-status").textContent = notice || (room.following ? "Yan is following Yueyue. Stop following whenever you like." : room.ready() ? "Together at the front. Your vows can begin whenever you are ready." : "Follow the center aisle. The pews are part of the scenery.");
    document.querySelector("#wedding-moment").textContent = room.completed ? "A moment kept · You can revisit it together." : "No hurry. You can leave and return whenever you like.";
    document.querySelector("#wedding-save-status").textContent = storage.message();
    speechView.render(active && !room.ceremony ? speech.snapshot() : null);
    interactions.render(active);
    ceremony.render(active);
  }
  function accept(result) { notice = result.ok ? "" : result.error; render(); wake(); return result; }
  function moveUser(point) { interactions.close(); return accept(room.move("yueyue", point)); }
  floor.addEventListener("click", event => {
    if (event.target.closest("button, .room-speech")) return;
    const bounds = floor.getBoundingClientRect();
    moveUser(geometry.unproject({ x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height }));
  });
  floor.addEventListener("keydown", event => {
    if (event.target !== floor) return;
    const steps = { ArrowUp: [0, -.075], ArrowDown: [0, .075], ArrowLeft: [-.22, 0], ArrowRight: [.22, 0] };
    if (!steps[event.key]) return;
    event.preventDefault();
    const [u, v] = steps[event.key];
    moveUser({ u: room.actors.yueyue.u + u, v: room.actors.yueyue.v + v });
  });
  document.querySelector("#wedding-walk-front").addEventListener("click", () => moveUser({ u: -.5, v: .025 }));
  document.querySelector("#wedding-join").addEventListener("click", () => accept(room.move("yan", { u: .5, v: .025 })));
  document.querySelector("#wedding-yueyue").addEventListener("click", () => floor.focus({ preventScroll: true }));
  function animate(time) {
    frame = 0;
    if (!active || document.hidden) return;
    room.advance(lastTime ? (time - lastTime) / 1000 : 0);
    speech.expire();
    lastTime = time;
    render();
    if (Object.values(room.actors).some(actor => actor.target) || speech.current) frame = requestAnimationFrame(animate);
    else save();
  }
  function wake() {
    if (active && !document.hidden && !frame) { lastTime = 0; frame = requestAnimationFrame(animate); }
  }
  function suspend() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    room.pause();
    speech.clear();
    save();
  }
  document.addEventListener("park-view-change", event => {
    const nextActive = event.detail === "wedding";
    if (active && !nextActive) suspend();
    active = nextActive;
    render();
    wake();
  });
  document.addEventListener("visibilitychange", () => {
    if (!active) return;
    if (document.hidden) suspend();
    render();
    wake();
  });
  window.addEventListener("pagehide", () => { if (active) suspend(); });
  window.addEventListener("resize", render);
  window.TogetherWedding = Object.freeze({
    observe() { return { ...room.snapshot(), view: active ? "wedding" : location.hash.slice(1), active,
      visible: !document.hidden, coordinates: "u: -1..1 across aisle; v: 0 at front, 1 at entrance", speech: speech.snapshot(),
      actions: ["observe", "move", "come", "face", "say", "stop_follow"] }; },
    act(input) {
      if (input?.action === "observe") return { ok: true, state: this.observe() };
      if (!active || document.hidden) return { ok: false, error: "Open the visible Wedding Chapel first." };
      if (input?.action === "say") {
        if (input.actor !== undefined && input.actor !== "yan") return { ok: false, error: "Only Yan can speak through this interface." };
        if (input.revision !== undefined && input.revision !== room.revision) return { ok: false, error: "The room has changed. Observe again." };
        const result = speech.say(input.text);
        if (result.ok) room.revision++;
        accept(result);
        return { ...result, state: this.observe() };
      }
      const result = room.command(input);
      accept(result);
      return { ...result, state: this.observe() };
    }
  });
  render();
})();
