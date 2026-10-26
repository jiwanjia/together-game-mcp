(function () {
  "use strict";
  const geometry = window.LivingRoomGeometry;
  const room = new window.LivingRoomState(window.LivingRoomStorage.load());
  const floor = document.querySelector("#room-floor");
  const menu = document.querySelector("#room-menu");
  const dialog = document.querySelector("#room-follow-dialog");
  const speechView = new window.LivingRoomSpeechView(floor, document.querySelector("#room-speech"),
    document.querySelector("#room-yan"), () => {
      if (room.speech.clear()) room.revision++;
      display();
    });
  const bedroomSpeechView = new window.LivingRoomSpeechView(document.querySelector(".bedroom-scene"),
    document.querySelector("#bedroom-speech"), document.querySelector("#bedroom-yan-anchor"), () => {
      if (room.speech.clear()) room.revision++;
      display();
    });
  let view = "welcome";
  let active = false, lastTime = 0, frame = 0, savedRevision = room.revision, renderedRevision = -1, dialogId = null, menuKind = null;
  const labels = { standing: "站着", walking: "走动中", sitting: "坐着" };
  const companion = new window.LivingRoomCompanionControls(room, floor, result => { resultMessage(result); wake(); }, showMenu);
  const reading = new window.ReadingView(room, result => { resultMessage(result); wake(); }, showMenu);
  const readingArt = new window.ReadingArt(floor);
  function message(text) { document.querySelector("#room-status").textContent = text; }
  function display() {
    const state = room.snapshot();
    const pair = state.reading.session ? null : geometry.seatedPair(state.actors);
    const pairImage = document.querySelector("#room-seated-pair");
    pairImage.hidden = !pair;
    if (pair) {
      pairImage.style.left = `${pair.x / 10}%`;
      pairImage.style.top = `${pair.y / 10}%`;
      pairImage.style.zIndex = pair.depth;
      pairImage.dataset.mirrored = String(pair.mirrored);
    }
    for (const [id, actor] of Object.entries(state.actors)) {
      const element = document.querySelector(`#room-${id}`);
      const paired = pair && id !== "yu";
      // The cutout always puts Yueyue on the left, regardless of seat reservations.
      const screenX = paired ? pair.x + (id === "yueyue" ? -40 : 32) : actor.screen.x;
      const screenY = paired ? pair.y + (id === "yueyue" ? -28 : 0) : actor.screen.y;
      element.style.left = `${screenX / 10}%`;
      element.style.top = `${screenY / 10}%`;
      element.style.zIndex = paired ? pair.depth + 1 : geometry.actorDepth(actor);
      element.dataset.paired = String(Boolean(paired));
      element.dataset.walking = String(actor.posture === "walking");
      element.dataset.facing = actor.facing;
      element.dataset.frame = actor.posture === "sitting" ? "2" : actor.posture === "walking" ? String(Math.floor(performance.now() / 190) % 2) : "0";
      const status = document.querySelector(`#room-${id}-status`);
      if (id === "yu") status.textContent = actor.seat !== null && actor.posture !== "walking" ? `${["Left", "Middle", "Right"][actor.seat]} · Sitting` : { standing: "Standing", walking: "Walking", sitting: "Sitting" }[actor.posture];
      else status.textContent = actor.seat !== null && actor.posture !== "walking" ? `${geometry.seats[actor.seat].name} · 坐着` : labels[actor.posture];
    }
    if (active) window.SofaSeatedTrio.render(state.reading.session ? {} : state.actors);
    readingArt.render(state, active);
    reading.render(state, active);
    speechView.render(active ? state.speech : null);
    bedroomSpeechView.render(view === "bedroom" ? state.speech : null);
    companion.render(active);
    document.querySelector("#room-stop-follow").hidden = !state.following;
    document.querySelector("#room-stand").hidden = state.actors.yueyue.posture !== "sitting";
    if (state.revision !== renderedRevision) {
      if (state.events.length) message(state.events.at(-1).message);
      if (menuKind) fillMenu();
      renderedRevision = state.revision;
    }
    if (state.revision !== savedRevision) {
      window.LivingRoomStorage.save(room.actors);
      savedRevision = state.revision;
    }
    document.querySelector("#room-save-status").textContent = window.LivingRoomStorage.message();
    if (active && state.invitation && dialogId !== state.invitation.id) {
      dialogId = state.invitation.id;
      if (!dialog.open) dialog.showModal();
    } else if (!state.invitation && dialog.open) { dialog.close(); dialogId = null; }
    const destination = document.querySelector("#room-destination");
    destination.hidden = !state.actors.yueyue.target;
    if (!destination.hidden) {
      const point = geometry.project(state.actors.yueyue.target);
      destination.style.left = `${point.x / 10}%`; destination.style.top = `${point.y / 10}%`;
    }
  }
  function resultMessage(result) { display(); if (!result.ok) message(result.error); }
  function moveUser(point) {
    menuKind = null; menu.hidden = true;
    if (companion.choosingDestination) companion.moveDestination(point);
    else resultMessage(room.move("yueyue", point));
    wake();
  }
  function fillMenu() {
    const actions = document.querySelector("#room-menu-actions");
    actions.replaceChildren();
    menu.dataset.kind = menuKind;
    document.querySelector("#room-menu-title").textContent = reading.title(menuKind) ?? (menuKind === "sofa" ? "沙发 · 月月坐哪里？" : menuKind === "yu" ? "With Yu" : "给哥哥留个邀请");
    const options = reading.title(menuKind) ? reading.options(menuKind) : menuKind === "yu" ? companion.options() : menuKind === "sofa" ? geometry.seats.map(seat => ({
      text: `${seat.name}${room.occupant(seat.id) ? ` · ${room.actors[room.occupant(seat.id)].name}` : " · 空着"}`,
      disabled: room.occupant(seat.id) !== null, run: () => resultMessage(room.sit("yueyue", seat.id))
    })) : [{ text: "过来陪我", run: () => room.inviteFromUser("come") },
      { text: "一起坐", run: () => room.inviteFromUser("sit") }];
    if (menuKind === "sofa" && room.actors.yueyue.seat !== null) options.push({ text: "月月起身", run: () => room.stand("yueyue") });
    if (["yan", "yu"].includes(menuKind)) options.push(...reading.companionOptions(menuKind));
    options.forEach(option => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "room-button";
      button.textContent = option.text; button.disabled = Boolean(option.disabled);
      button.addEventListener("click", event => {
        const result = option.run(event);
        if (option.keepOpen) return;
        menuKind = null; menu.hidden = true; display();
        if (result?.ok === false) message(result.error);
      });
      actions.append(button);
    });
  }
  function showMenu(kind) { companion.cancelDestination(); menuKind = kind; fillMenu(); menu.hidden = false; display(); menu.querySelector("button.room-button:not(:disabled)")?.focus({ preventScroll: true }); }
  floor.addEventListener("click", event => {
    if (event.target.closest("button, .room-speech")) return;
    const bounds = floor.getBoundingClientRect();
    moveUser(geometry.unproject({ x: (event.clientX - bounds.left) / bounds.width * 1000, y: (event.clientY - bounds.top) / bounds.height * 1000 }));
  });
  floor.addEventListener("keydown", event => {
    if (event.target !== floor) return;
    const steps = { ArrowUp: [-.055, -.055], ArrowDown: [.055, .055], ArrowLeft: [.055, -.055], ArrowRight: [-.055, .055] };
    if (!steps[event.key]) return;
    event.preventDefault(); const [u, v] = steps[event.key];
    const actor = room.actors[companion.choosingDestination ? "yu" : "yueyue"];
    moveUser({ u: actor.u + u, v: actor.v + v });
  });
  document.querySelector("#room-sofa").addEventListener("click", () => showMenu("sofa"));
  document.querySelector("#room-yan").addEventListener("click", () => showMenu("yan"));
  document.querySelector("#room-yueyue").addEventListener("click", () => { if (room.actors.yueyue.seat !== null) showMenu("sofa"); });
  document.querySelector("#room-menu-close").addEventListener("click", () => { menuKind = null; menu.hidden = true; display(); });
  document.querySelector("#room-stop-follow").addEventListener("click", () => { room.stopFollow(); display(); });
  document.querySelector("#room-stand").addEventListener("click", () => resultMessage(room.stand("yueyue")));
  function answerInvitation(event, accepted) {
    if (!event.isTrusted) return; // Approval belongs to a real page interaction, never the actor command interface.
    const result = room.respond(dialogId, accepted);
    dialog.close(); dialogId = null; resultMessage(result); wake();
  }
  document.querySelector("#room-follow-accept").addEventListener("click", event => answerInvitation(event, true));
  document.querySelector("#room-follow-decline").addEventListener("click", event => answerInvitation(event, false));
  dialog.addEventListener("cancel", event => { event.preventDefault(); answerInvitation(event, false); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !dialog.open) { companion.cancelDestination(); menuKind = null; menu.hidden = true; display(); } });
  for (const [selector, view] of [["#enter-park", "park"], ["#enter-home", "home"], ["#park-back-home", "welcome"], ["#room-back", "welcome"]]) {
    document.querySelector(selector).addEventListener("click", () => window.ParkNavigation.show(view));
  }
  function animate(time) {
    frame = 0;
    if ((!active && view !== "bedroom") || document.hidden) return;
    if (active) room.advance(lastTime ? (time - lastTime) / 1000 : 0);
    else if (room.speech.expire()) room.revision++;
    lastTime = time;
    display();
    if (Object.values(room.speeches).some(speech => speech.current) || (active && (Object.values(room.actors).some(actor => actor.path.length) || room.invitation || room.reading.invitation))) frame = requestAnimationFrame(animate);
  }
  function wake() { if ((active || view === "bedroom") && !document.hidden && !frame) { lastTime = 0; frame = requestAnimationFrame(animate); } }
  document.addEventListener("park-view-change", event => {
    if (view !== event.detail) {
      for (const speech of Object.values(room.speeches)) { if (speech.clear()) room.revision++; }
    }
    view = event.detail;
    active = view === "home";
    if (!active) { room.reading.end(); room.stopFollow(); menuKind = null; menu.hidden = true; }
    if (frame) cancelAnimationFrame(frame); frame = 0;
    display(); wake();
  });
  document.addEventListener("visibilitychange", () => { if (frame) cancelAnimationFrame(frame); frame = 0; wake(); });
  window.addEventListener("resize", display);
  document.addEventListener("playtogether-room-update", () => { display(); wake(); });
  floor.addEventListener("click", wake);
  document.querySelector("#room-menu-actions").addEventListener("click", wake);
  window.addEventListener("pagehide", () => window.LivingRoomStorage.save(room.actors));
  // A semantic game tool, called through the existing browser tooling in this same tab.
  window.TogetherHome = Object.freeze({
    act(input) {
      const bedroomSay = view === "bedroom" && input?.action === "say";
      if (input?.action !== "observe" && (document.hidden || (!active && !bedroomSay))) return { ok: false, error: "请先打开可见的客厅；卧室目前只能说话。" };
      const result = room.command(input); resultMessage(result); wake(); return result;
    },
    observe() { return { ...room.snapshot(), view, active, visible: !document.hidden, coordinates: "u/v: 0..1等距地面坐标（客厅）", actions: view === "bedroom" ? ["observe", "say"] : ["observe", "move", "come", "sit", "stand", "face", "invite_follow", "stop_follow", "say", "read_aloud", "invite_read", "accept_read", "decline_read", "read_line", "end_read"] }; }
  });
  window.TogetherYu = companion.interface(() => window.TogetherHome.observe());
  display();
})();
