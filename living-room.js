(function () {
  "use strict";
  const geometry = window.LivingRoomGeometry;
  const room = new window.LivingRoomState(window.LivingRoomStorage.load());
  const floor = document.querySelector("#room-floor");
  const menu = document.querySelector("#room-menu");
  const dialog = document.querySelector("#room-follow-dialog");
  let active = false, lastTime = 0, frame = 0, savedRevision = -1, renderedRevision = -1, dialogId = null, menuKind = null;
  const labels = { standing: "站着", walking: "走动中", sitting: "坐着" };
  function message(text) { document.querySelector("#room-status").textContent = text; }
  function display() {
    const state = room.snapshot();
    for (const [id, actor] of Object.entries(state.actors)) {
      const element = document.querySelector(`#room-${id}`);
      element.style.left = `${actor.screen.x / 10}%`;
      element.style.top = `${actor.screen.y / 10}%`;
      element.style.zIndex = Math.round(actor.screen.y);
      element.dataset.walking = String(actor.posture === "walking");
      element.dataset.facing = actor.facing;
      element.dataset.frame = actor.posture === "sitting" ? "2" : actor.posture === "walking" ? String(Math.floor(performance.now() / 190) % 2) : "0";
      document.querySelector(`#room-${id}-status`).textContent = actor.seat !== null && actor.posture !== "walking" ? `${geometry.seats[actor.seat].name} · 坐着` : labels[actor.posture];
    }
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
  function moveUser(point) { menuKind = null; menu.hidden = true; resultMessage(room.move("yueyue", point)); wake(); }
  function fillMenu() {
    const actions = document.querySelector("#room-menu-actions");
    actions.replaceChildren();
    document.querySelector("#room-menu-title").textContent = menuKind === "sofa" ? "沙发 · 月月坐哪里？" : "给哥哥留个邀请";
    const options = menuKind === "sofa" ? geometry.seats.map(seat => ({
      text: `${seat.name}${room.occupant(seat.id) ? ` · ${room.actors[room.occupant(seat.id)].name}` : " · 空着"}`,
      disabled: room.occupant(seat.id) !== null, run: () => resultMessage(room.sit("yueyue", seat.id))
    })) : [{ text: "过来陪我", run: () => room.inviteFromUser("come") },
      { text: "一起坐", run: () => room.inviteFromUser("sit") }];
    if (menuKind === "sofa" && room.actors.yueyue.seat !== null) options.push({ text: "月月起身", run: () => room.stand("yueyue") });
    options.forEach(option => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "room-button";
      button.textContent = option.text; button.disabled = Boolean(option.disabled);
      button.addEventListener("click", () => { option.run(); menuKind = null; menu.hidden = true; display(); });
      actions.append(button);
    });
  }
  function showMenu(kind) { menuKind = kind; fillMenu(); menu.hidden = false; menu.querySelector("button.room-button:not(:disabled)")?.focus({ preventScroll: true }); }
  floor.addEventListener("click", event => {
    if (event.target.closest("button")) return;
    const bounds = floor.getBoundingClientRect();
    moveUser(geometry.unproject({ x: (event.clientX - bounds.left) / bounds.width * 1000, y: (event.clientY - bounds.top) / bounds.height * 1000 }));
  });
  floor.addEventListener("keydown", event => {
    if (event.target !== floor) return;
    const steps = { ArrowUp: [-.055, -.055], ArrowDown: [.055, .055], ArrowLeft: [.055, -.055], ArrowRight: [-.055, .055] };
    if (!steps[event.key]) return;
    event.preventDefault(); const [u, v] = steps[event.key];
    moveUser({ u: room.actors.yueyue.u + u, v: room.actors.yueyue.v + v });
  });
  document.querySelector("#room-sofa").addEventListener("click", () => showMenu("sofa"));
  document.querySelector("#room-yan").addEventListener("click", () => showMenu("yan"));
  document.querySelector("#room-yueyue").addEventListener("click", () => { if (room.actors.yueyue.seat !== null) showMenu("sofa"); });
  document.querySelector("#room-menu-close").addEventListener("click", () => { menuKind = null; menu.hidden = true; });
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
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !dialog.open) { menuKind = null; menu.hidden = true; } });
  for (const [selector, view] of [["#enter-park", "park"], ["#enter-home", "home"], ["#park-back-home", "welcome"], ["#room-back", "welcome"]]) {
    document.querySelector(selector).addEventListener("click", () => window.ParkNavigation.show(view));
  }
  function animate(time) {
    frame = 0;
    if (!active || document.hidden) return;
    room.advance(lastTime ? (time - lastTime) / 1000 : 0); lastTime = time;
    display();
    if (Object.values(room.actors).some(actor => actor.path.length) || room.invitation) frame = requestAnimationFrame(animate);
  }
  function wake() { if (active && !document.hidden && !frame) { lastTime = 0; frame = requestAnimationFrame(animate); } }
  document.addEventListener("park-view-change", event => {
    active = event.detail === "home";
    if (!active) { room.stopFollow(); menuKind = null; menu.hidden = true; }
    if (frame) cancelAnimationFrame(frame); frame = 0;
    display(); wake();
  });
  document.addEventListener("visibilitychange", () => { if (frame) cancelAnimationFrame(frame); frame = 0; wake(); });
  floor.addEventListener("click", wake);
  document.querySelector("#room-menu-actions").addEventListener("click", wake);
  window.addEventListener("pagehide", () => window.LivingRoomStorage.save(room.actors));
  // A semantic game tool, called through the existing browser tooling in this same tab.
  window.TogetherHome = Object.freeze({
    act(input) {
      if (input?.action !== "observe" && (!active || document.hidden)) return { ok: false, error: "请先打开可见的客厅。" };
      const result = room.command(input); resultMessage(result); wake(); return result;
    },
    observe() { return { ...room.snapshot(), active, visible: !document.hidden, coordinates: "u/v: 0..1等距地面坐标", actions: ["observe", "move", "come", "sit", "stand", "face", "invite_follow", "stop_follow"] }; }
  });
  display();
})();
