(function () {
  "use strict";
  const sample = ["窗边的小树晃了晃叶子，像是在向屋里的人问好。", "有人把书翻过一页，阳光就停在那一页的边边上。", "他们没有急着读完故事，今天还有很长、很安静的下午。"];
  const book = `<svg class="reading-book" viewBox="0 0 100 65" aria-hidden="true"><path d="M50 13 Q30 1 5 8 L8 53 Q30 46 50 60 Q70 46 92 53 L95 8 Q70 1 50 13Z" fill="#fff5df" stroke="#a77c62" stroke-width="3"/><path d="M50 13V60 M16 19Q31 15 42 22 M16 29Q31 25 42 32 M58 22Q72 15 84 19 M58 32Q72 25 84 29" fill="none" stroke="#cdb190" stroke-width="2"/></svg>`;
  class ReadingView {
    constructor(room, changed) {
      this.room = room;
      this.changed = changed;
      this.active = false;
      this.requestId = null;
      this.lineIndex = 0;
      const floor = document.querySelector("#room-floor");
      floor.insertAdjacentHTML("beforeend", '<button id="room-bookshelf" class="reading-shelf" type="button" aria-label="Bookshelf · Read a book"><span>Bookshelf</span></button>');
      document.querySelector(".room-notes").insertAdjacentHTML("beforeend", '<button id="reading-open" class="room-button" type="button">Bookshelf · Read a book</button><p id="reading-status" role="status" hidden></p><button id="reading-next" class="room-button" type="button" hidden>Read next sample line</button><button id="reading-end" class="room-button" type="button" hidden>Close the book</button>');
      document.body.insertAdjacentHTML("beforeend", `<dialog id="reading-menu" class="room-follow-dialog reading-menu" aria-labelledby="reading-title"><div class="room-menu-heading"><h2 id="reading-title">A book for this afternoon</h2><button id="reading-close" class="text-button" type="button" aria-label="Close bookshelf">×</button></div><p>Choose a little time on your own, or invite someone to join you.</p><div id="reading-choices" class="room-menu-actions"></div></dialog>
        <dialog id="reading-invitation" class="room-follow-dialog" aria-labelledby="reading-invitation-title"><p class="eyebrow">An invitation for you</p><h2 id="reading-invitation-title"></h2><p>Come sit nearby and listen? You can leave whenever you like.</p><div class="room-menu-actions"><button id="reading-accept" class="room-button" type="button">Come and listen</button><button id="reading-decline" class="text-button" type="button">Maybe later</button></div></dialog>`);
      this.menu = document.querySelector("#reading-menu");
      this.invitation = document.querySelector("#reading-invitation");
      for (const id of ["room-bookshelf", "reading-open"]) document.getElementById(id).addEventListener("click", () => this.open());
      document.querySelector("#reading-close").addEventListener("click", () => this.menu.close());
      document.querySelector("#reading-end").addEventListener("click", () => { room.reading.end(); changed({ ok: true }); });
      document.querySelector("#reading-next").addEventListener("click", () => {
        const reader = room.reading.session?.reader;
        const result = room.command({ action: "read_line", text: sample[this.lineIndex % sample.length] }, Date.now(), reader);
        if (result.ok) this.lineIndex++;
        changed(result);
      });
      document.querySelector("#reading-accept").addEventListener("click", event => this.respond(event, true));
      document.querySelector("#reading-decline").addEventListener("click", event => this.respond(event, false));
      this.invitation.addEventListener("cancel", event => { event.preventDefault(); this.respond(event, false); });
      for (const actor of floor.querySelectorAll(".room-actor")) actor.insertAdjacentHTML("beforeend", book);
    }
    choices(options) {
      const actions = document.querySelector("#reading-choices");
      actions.replaceChildren();
      for (const { text, run } of options) {
        const button = document.createElement("button");
        button.className = "room-button";
        button.type = "button";
        button.textContent = text;
        button.addEventListener("click", run);
        actions.append(button);
      }
      actions.querySelector("button")?.focus();
    }
    open() {
      document.querySelector("#reading-title").textContent = "A book for this afternoon";
      this.choices([
        { text: "Read on my own", run: () => this.start("alone") },
        { text: "Invite to read", run: () => this.chooseCompanion("together") },
        { text: "Ask someone to read", run: () => this.chooseCompanion("listen") }
      ]);
      this.menu.showModal();
    }
    chooseCompanion(mode) {
      const targets = mode === "together" ? [["yan", "Yan"], ["yu", "Yu"], ["both", "Both"]] : [["yan", "Yan"], ["yu", "Yu"]];
      this.choices(targets.map(([id, name]) => ({ text: name, run: () => this.start(mode, id) })));
    }
    start(mode, selected) {
      const result = this.room.reading.userStart(mode, selected);
      if (result.ok) { this.lineIndex = 0; this.menu.close(); }
      this.changed(result);
      if (!result.ok) document.querySelector("#reading-title").textContent = result.error;
    }
    companionOptions(actorId) {
      return [
        { text: "Read Aloud", run: () => this.room.command({ action: "read_aloud" }, Date.now(), actorId) },
        { text: "Invite Yueyue to Listen", run: () => this.room.command({ action: "invite_read" }, Date.now(), actorId) }
      ];
    }
    respond(event, accepted) {
      if (!event.isTrusted) return;
      const result = this.room.reading.respond(this.requestId, accepted);
      this.invitation.close();
      this.requestId = null;
      this.changed(result);
    }
    render(state, active) {
      this.active = active;
      const reading = state.reading;
      const session = reading.session;
      const ready = Boolean(session && session.participants.every(id => state.actors[id].posture === "sitting"));
      for (const [id, actor] of Object.entries(state.actors)) {
        const element = document.querySelector(`#room-${id}`);
        const participating = active && ready && session.participants.includes(id);
        element.dataset.reading = participating ? ((session.reader ?? session.participants[0]) === id ? "book" : "listening") : "none";
      }
      const status = document.querySelector("#reading-status");
      status.hidden = !session;
      status.textContent = !session ? "" : !ready ? "Walking to the reading seats…" : session.reader ? `${session.reader === "yan" ? "Yan" : "Yu"} is reading. Original sample story · text only.` : "A quiet moment with a book.";
      document.querySelector("#reading-end").hidden = !session && !reading.invitation;
      document.querySelector("#reading-next").hidden = !active || !ready || !session.reader;
      if (active && reading.invitation && this.requestId !== reading.invitation.id) {
        this.requestId = reading.invitation.id;
        document.querySelector("#reading-invitation-title").textContent = `${reading.invitation.actorId === "yan" ? "Yan" : "Yu"} would like to read to you`;
        if (this.menu.open) this.menu.close();
        this.invitation.showModal();
      } else if ((!active || !reading.invitation) && this.invitation.open) {
        this.invitation.close();
        this.requestId = null;
      }
      if (!active && this.menu.open) this.menu.close();
    }
  }
  window.ReadingView = ReadingView;
})();
