(function () {
  "use strict";
  const geometry = window.BedroomGeometry;
  const floor = document.querySelector("#bedroom-floor");
  const names = { yueyue: "Yueyue", yan: "Yan", yu: "Yu" };
  const key = "playtogether-bedroom-v1";
  let store, saved, blocked = false, storageError = "";
  try {
    store = location.search.includes("preview") ? sessionStorage : localStorage;
    const raw = store.getItem(key);
    if (raw) {
      const record = JSON.parse(raw);
      if (record.version !== 1 || !record.actors || typeof record.actors !== "object") throw new Error("Invalid bedroom positions");
      saved = record.actors;
    }
  } catch (_) { blocked = true; storageError = "Bedroom positions could not be loaded; the original record is kept."; }
  const room = new window.BedroomState(saved);
  let active = false, frame = 0, lastTime = 0, choosing = null, notice = "", savedRevision = room.revision;
  floor.insertAdjacentHTML("beforeend", '<button id="bedroom-bed" class="room-furniture-hotspot bedroom-bed-hotspot" type="button" aria-label="Bed · Rest together"><span>Bed · Rest together</span></button>');
  const art = new window.BedroomArt(floor);
  floor.insertAdjacentHTML("beforeend", '<button id="bedroom-vanity" class="room-furniture-hotspot bedroom-vanity-hotspot" type="button" aria-label="Yueyue’s Vanity"><span>Yueyue’s Vanity</span></button>');
  document.querySelector(".bedroom-notes").insertAdjacentHTML("beforeend", '<button id="bedroom-open-vanity" class="room-button" type="button">Yueyue’s Vanity</button>');
  floor.parentElement.insertAdjacentHTML("beforeend", '<div id="bedroom-menu" class="room-menu" hidden aria-label="Bedroom actions"><div class="room-menu-heading"><strong id="bedroom-menu-title"></strong><button id="bedroom-menu-close" class="text-button" type="button">Close ×</button></div><div id="bedroom-menu-actions" class="room-menu-actions"></div></div>');
  document.querySelector(".bedroom-notes").insertAdjacentHTML("beforeend", '<p id="bedroom-status" role="status" aria-live="polite"></p><dl id="bedroom-positions" class="room-positions"></dl><button id="bedroom-interact-yan" class="room-button" type="button">Interact with Yan</button><button id="bedroom-interact-yu" class="room-button" type="button">Interact with Yu</button><button id="bedroom-wake" class="room-button" type="button" hidden>Get up together</button><p id="bedroom-save-status" class="save-status"></p>');
  const menu = document.querySelector("#bedroom-menu");
  const speechViews = {};
  for (const id of Object.keys(names)) {
    floor.insertAdjacentHTML("beforeend", `<button id="bedroom-${id}" class="room-actor bedroom-actor room-actor--${id}" type="button" aria-label="${names[id]}"><span class="room-sprite" aria-hidden="true"></span><span class="room-name">${names[id]}</span></button>`);
    if (id !== "yan") floor.insertAdjacentHTML("beforeend", `<div id="bedroom-${id}-speech" class="room-speech" hidden><div class="room-speech-heading"><span>${names[id]}</span><button type="button" aria-label="Close ${names[id]}’s speech">×</button></div><p class="room-speech-text" role="status" aria-live="polite"></p></div>`);
    const bubble = document.querySelector(id === "yan" ? "#bedroom-speech" : `#bedroom-${id}-speech`);
    speechViews[id] = new window.LivingRoomSpeechView(floor, bubble, document.querySelector(`#bedroom-${id}`), () => {
      if (room.speeches[id].clear()) room.revision++;
      render();
    });
    document.querySelector(`#bedroom-${id}`).addEventListener("click", () => showMenu(id));
    document.querySelector("#bedroom-positions").insertAdjacentHTML("beforeend", `<div><dt>${names[id]}</dt><dd id="bedroom-${id}-status"></dd></div>`);
  }
  function save() {
    if (savedRevision === room.revision || !store || blocked) return;
    try { store.setItem(key, JSON.stringify({ version: 1, actors: room.positions() })); storageError = ""; }
    catch (_) { storageError = "Bedroom positions could not be saved this time."; }
    savedRevision = room.revision;
  }
  function render() {
    const state = room.snapshot();
    for (const [id, actor] of Object.entries(state.actors)) {
      const element = document.querySelector(`#bedroom-${id}`);
      element.style.left = `${actor.screen.x / 10}%`;
      element.style.top = `${actor.screen.y / 10}%`;
      element.style.zIndex = actor.posture === "sleeping" ? 10 : Math.round(actor.screen.y);
      element.dataset.walking = String(actor.posture === "walking");
      element.dataset.sleeping = String(actor.posture === "sleeping");
      element.dataset.facing = actor.facing;
      element.dataset.frame = actor.posture === "walking" ? String(Math.floor(performance.now() / 190) % 2) : "0";
      document.querySelector(`#bedroom-${id}-status`).textContent = { walking: "Walking", standing: "Standing", sleeping: "Resting" }[actor.posture];
      speechViews[id].render(active ? state.speeches[id] : null);
    }
    art.render(state);
    document.querySelector("#bedroom-wake").hidden = !room.resting && !room.settling && !state.rest.invitation;
    document.querySelector("#bedroom-wake").textContent = state.rest.invitation ? "Cancel invitation" : "Get up together";
    document.querySelector("#bedroom-status").textContent = notice || (state.rest.invitation ? `Waiting for ${names[state.rest.invitation.to]} to answer Yueyue’s invitation.` : choosing ? `Choose a clear floor spot for ${names[choosing]}. Escape cancels.` : room.resting ? state.rest.participants.length === 3 ? "Three little heads under the cherry quilt. ♡" : `Yueyue and ${names[state.rest.participants[1]]}, tucked in together. ♡` : room.settling ? "Walking to bed together…" : "Click clear floor to walk. Choose the bed to rest together.");
    document.querySelector("#bedroom-save-status").textContent = storageError || "Bedroom positions are kept here. Resting and speech reset after refresh.";
    save();
  }
  function accept(result) { notice = result.ok ? "" : result.error; render(); wake(); return result; }
  function closeMenu() { menu.hidden = true; }
  function showMenu(kind) {
    choosing = null;
    const actions = document.querySelector("#bedroom-menu-actions");
    actions.replaceChildren();
    document.querySelector("#bedroom-menu-title").textContent = kind === "bed" ? "Bed · Rest together" : `With ${names[kind]}`;
    const options = kind === "bed" ? bedOptions() : kind === "yueyue" ?
      [{ text: "Stand up", run: () => room.stand("yueyue") }] : [
        { text: "Come closer", run: () => room.command({ action: "come" }, kind) },
        { text: "Choose a walking spot", run: () => { choosing = kind; return { ok: true }; } },
        { text: "Stand up", run: () => room.command({ action: "stand" }, kind) },
        { text: "Face Yueyue", run: () => room.command({ action: "face" }, kind) },
        { text: `Invite ${names[kind]} to rest`, run: event => userRest(event, kind) }
      ];
    for (const option of options) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "room-button";
      button.textContent = option.text;
      button.addEventListener("click", event => { const result = option.run(event); closeMenu(); accept(result); });
      actions.append(button);
    }
    menu.hidden = false;
    render();
    actions.querySelector("button")?.focus({ preventScroll: true });
  }
  function userRest(event, target) {
    if (!event.isTrusted) return { ok: false, error: "Choose the bed on the page." };
    return target ? room.rest.invite(target) : room.restTogether();
  }
  function bedOptions() {
    if (room.resting || room.settling || room.rest.invitation) return [{ text: room.rest.invitation ? "Cancel invitation" : "Get up together", run: () => room.wake() }];
    return [{ text: "Rest together", run: event => userRest(event) }, ...["yan", "yu"].map(id => ({ text: `Invite ${names[id]}`, run: event => userRest(event, id) }))];
  }
  function moveUser(point) {
    const result = room.move(choosing || "yueyue", point);
    if (result.ok) choosing = null;
    closeMenu();
    accept(result);
  }
  floor.addEventListener("click", event => {
    if (event.target.closest("button, .room-speech")) return;
    const box = floor.getBoundingClientRect();
    moveUser(geometry.unproject({ x: (event.clientX - box.left) / box.width * 1000, y: (event.clientY - box.top) / box.height * 1000 }));
  });
  floor.addEventListener("keydown", event => {
    if (event.target !== floor) return;
    const steps = { ArrowUp: [-.055, -.055], ArrowDown: [.055, .055], ArrowLeft: [.055, -.055], ArrowRight: [-.055, .055] };
    if (!steps[event.key]) return;
    event.preventDefault();
    const actor = room.actors[choosing || "yueyue"];
    const [u, v] = steps[event.key];
    moveUser({ u: actor.u + u, v: actor.v + v });
  });
  document.querySelector("#bedroom-bed").addEventListener("click", () => showMenu("bed"));
  document.querySelector("#bedroom-menu-close").addEventListener("click", closeMenu);
  document.querySelector("#bedroom-wake").addEventListener("click", () => accept(room.wake()));
  for (const id of ["yan", "yu"]) document.querySelector(`#bedroom-interact-${id}`).addEventListener("click", () => showMenu(id));
  document.addEventListener("keydown", event => { if (active && event.key === "Escape") { choosing = null; closeMenu(); render(); } });
  function animate(time) {
    frame = 0;
    if (!active || document.hidden) return;
    room.advance(lastTime ? (time - lastTime) / 1000 : 0);
    lastTime = time;
    render();
    if (room.rest.invitation || Object.values(room.actors).some(actor => actor.path.length) || Object.values(room.speeches).some(speech => speech.current)) frame = requestAnimationFrame(animate);
  }
  function wake() { if (active && !document.hidden && !frame) { lastTime = 0; frame = requestAnimationFrame(animate); } }
  document.addEventListener("park-view-change", event => {
    const next = event.detail === "bedroom";
    if (active && !next) { room.pause(); choosing = null; closeMenu(); }
    active = next;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    render();
    wake();
  });
  document.addEventListener("visibilitychange", () => { if (frame) cancelAnimationFrame(frame); frame = 0; wake(); });
  window.addEventListener("resize", render);
  window.addEventListener("pagehide", () => { room.pause(); save(); });
  window.BedroomHome = Object.freeze({
    observe(actorId = "yan") { return { ...room.snapshot(), view: active ? "bedroom" : location.hash.slice(1), active, visible: !document.hidden,
      controlledActor: actorId, coordinates: "Bedroom floor u/v: 0..1", actions: ["observe", "move", "come", "stand", "wake", "face", "say", "accept_rest", "decline_rest"] }; },
    act(input, actorId = "yan") {
      if (input?.action !== "observe" && (!active || document.hidden)) return { ok: false, error: "Open the visible bedroom first." };
      const result = room.command(input, actorId);
      if (input?.action !== "observe") accept(result);
      return { ...result, state: this.observe(actorId) };
    }
  });
  render();
})();
