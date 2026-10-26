(function () {
  "use strict";
  class ReadingArt {
    constructor(floor) {
      for (const id of ["yueyue", "yan", "yu"]) {
        const image = document.createElement("img");
        image.className = "reading-solo-art";
        image.src = `assets/reading/${id}-reading-v1.png`;
        image.alt = "";
        image.setAttribute("aria-hidden", "true");
        image.draggable = false;
        document.querySelector(`#room-${id}`).append(image);
      }
      this.pair = document.createElement("img");
      this.pair.className = "reading-pair-art";
      this.pair.id = "reading-pair-art";
      this.pair.alt = "";
      this.pair.hidden = true;
      this.pair.setAttribute("aria-hidden", "true");
      floor.append(this.pair);
    }
    render(state, active) {
      const session = state.reading.session;
      for (const id of Object.keys(state.actors)) document.querySelector(`#room-${id}`).dataset.reading = "none";
      const ready = active && session && session.participants.every(id => !state.actors[id].target);
      this.pair.hidden = !ready || session.participants.length !== 2;
      if (!ready) return;
      if (session.participants.length === 1) {
        document.querySelector(`#room-${session.participants[0]}`).dataset.reading = "solo";
        return;
      }
      const companion = session.participants.find(id => id !== "yueyue");
      const participants = session.participants.map(id => state.actors[id]);
      const x = participants.reduce((sum, actor) => sum + actor.screen.x, 0) / 2;
      const y = Math.max(...participants.map(actor => actor.screen.y)) - 8;
      const source = `assets/reading/yueyue-${companion}-reading-v1.png`;
      if (this.pair.getAttribute("src") !== source) this.pair.src = source;
      this.pair.style.left = `${x / 10}%`;
      this.pair.style.top = `${y / 10}%`;
      const depth = Math.max(...participants.map(actor => window.LivingRoomGeometry.actorDepth(actor)));
      this.pair.style.zIndex = depth;
      for (const id of session.participants) {
        const element = document.querySelector(`#room-${id}`);
        element.dataset.reading = "pair";
        element.style.left = `${(x + (id === "yueyue" ? -48 : 48)) / 10}%`;
        element.style.top = `${y / 10}%`;
        element.style.zIndex = depth + 1;
      }
    }
  }
  window.ReadingArt = ReadingArt;
})();
