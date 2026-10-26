(function () {
  "use strict";
  class SpeechView {
    constructor(floor, bubble, actor, dismiss) {
      this.floor = floor;
      this.bubble = bubble;
      this.actor = actor;
      this.text = bubble.querySelector(".room-speech-text");
      bubble.querySelector("button").addEventListener("click", dismiss);
    }
    render(speech) {
      this.bubble.hidden = !speech;
      if (!speech) return;
      if (this.text.textContent !== speech.text) this.text.textContent = speech.text;
      const floor = this.floor.getBoundingClientRect();
      const actor = this.actor.getBoundingClientRect();
      this.text.style.maxHeight = `${Math.min(120, floor.height * .3)}px`;
      const bubble = this.bubble.getBoundingClientRect();
      const headX = actor.left + actor.width / 2 - floor.left;
      const left = Math.max(8, Math.min(headX - bubble.width / 2, floor.width - bubble.width - 8));
      const top = Math.max(8, Math.min(actor.top - floor.top - bubble.height - 8, floor.height - bubble.height - 8));
      this.bubble.style.left = `${left}px`;
      this.bubble.style.top = `${top}px`;
      this.bubble.style.setProperty("--speech-tail", `${Math.max(16, Math.min(headX - left, bubble.width - 16))}px`);
    }
  }
  window.LivingRoomSpeechView = SpeechView;
})();
