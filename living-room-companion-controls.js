(function () {
  "use strict";
  class CompanionControls {
    constructor(room, floor, changed, showMenu) {
      this.room = room;
      this.floor = floor;
      this.changed = changed;
      this.showMenu = showMenu;
      this.choosingDestination = false;
      this.active = false;
      this.speech = new window.LivingRoomSpeechView(floor, document.querySelector("#room-yu-speech"),
        document.querySelector("#room-yu"), () => {
          if (room.speeches.yu.clear()) room.revision++;
          changed({ ok: true });
        });
      document.querySelector("#room-yu").addEventListener("click", () => showMenu("yu"));
      document.querySelector("#room-interact-yu").addEventListener("click", () => showMenu("yu"));
    }
    command(input) { return this.room.command(input, Date.now(), "yu"); }
    options() {
      const room = this.room;
      return [
        { text: "Come Closer", run: () => this.command({ action: "come" }) },
        { text: "Choose a Walking Spot", run: () => { this.choosingDestination = true; return { ok: true }; } },
        ...window.LivingRoomGeometry.seats.map(seat => ({
          text: `Sit · ${["Left", "Middle", "Right"][seat.id]}${room.occupant(seat.id) ? ` · ${room.actors[room.occupant(seat.id)].name}` : ""}`,
          disabled: room.occupant(seat.id) !== null && room.occupant(seat.id) !== "yu",
          run: () => this.command({ action: "sit", seat: seat.id })
        })),
        { text: "Stand Up", run: () => this.command({ action: "stand" }) },
        { text: "Face Yueyue", run: () => this.command({ action: "face" }) }
      ];
    }
    moveDestination(point) {
      const result = this.command({ action: "move", u: point.u, v: point.v });
      if (result.ok) this.choosingDestination = false;
      this.changed(result);
    }
    cancelDestination() { this.choosingDestination = false; }
    render(active) {
      this.active = active;
      if (!active) this.cancelDestination();
      this.speech.render(active ? this.room.speeches.yu.snapshot() : null);
      if (active) this.separateSpeech();
      document.querySelector("#room-yu-destination-note").hidden = !this.choosingDestination;
      document.querySelector("#room-yu").setAttribute("aria-expanded", String(active && !document.querySelector("#room-menu").hidden && document.querySelector("#room-menu").dataset.kind === "yu"));
    }
    separateSpeech() {
      const yan = document.querySelector("#room-speech");
      const yu = document.querySelector("#room-yu-speech");
      if (yan.hidden || yu.hidden) return;
      const a = yan.getBoundingClientRect();
      const b = yu.getBoundingClientRect();
      if (a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top) return;
      const floor = this.floor.getBoundingClientRect();
      const above = b.top - floor.top - a.height - 8;
      if (above >= 8) { yan.style.top = `${above}px`; return; }
      const maxText = Math.max(24, (floor.height - 24) / 2 - 54);
      for (const bubble of [yan, yu]) bubble.querySelector(".room-speech-text").style.maxHeight = `${Math.min(120, maxText)}px`;
      yan.style.top = "8px";
      yu.style.top = `${16 + yan.getBoundingClientRect().height}px`;
    }
    interface(observe) {
      return Object.freeze({
        observe: () => ({ ...observe(), controlledActor: "yu", actions: ["observe", "move", "come", "sit", "stand", "face", "say", "read_aloud", "invite_read", "accept_read", "decline_read", "read_line", "end_read"] }),
        act: input => {
          if (input?.action !== "observe" && (!this.active || document.hidden)) return { ok: false, error: "Open the visible living room first." };
          const result = this.command(input);
          this.changed(result);
          return result;
        }
      });
    }
  }
  window.LivingRoomCompanionControls = CompanionControls;
})();
