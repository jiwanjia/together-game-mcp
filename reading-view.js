(function () {
  "use strict";
  class ReadingView {
    constructor(room, changed, showMenu) {
      this.room = room;
      this.changed = changed;
      this.showMenu = showMenu;
      this.requestId = null;
      this.lineIndex = 0;
      const floor = document.querySelector("#room-floor");
      floor.insertAdjacentHTML("beforeend", '<button id="room-bookshelf" class="room-furniture-hotspot reading-shelf" type="button" aria-label="Bookshelf · Read a book"><span>Bookshelf · Read a book</span></button><div id="room-yueyue-speech" class="room-speech" hidden><div class="room-speech-heading"><span>Yueyue</span><button type="button" aria-label="Close Yueyue’s reading line">×</button></div><p class="room-speech-text" role="status" aria-live="polite"></p></div>');
      document.querySelector(".room-notes").insertAdjacentHTML("beforeend", '<button id="reading-open" class="room-button" type="button">Bookshelf · Read a book</button><p id="reading-status" role="status" hidden></p><button id="reading-next" class="room-button" type="button" hidden>Read next sample line</button><button id="reading-end" class="room-button" type="button" hidden>Close the book</button>');
      this.userSpeech = new window.LivingRoomSpeechView(floor, document.querySelector("#room-yueyue-speech"), document.querySelector("#room-yueyue"), () => {
        if (room.speeches.yueyue.clear()) room.revision++;
        changed({ ok: true });
      });
      for (const id of ["room-bookshelf", "reading-open"]) document.getElementById(id).addEventListener("click", () => showMenu("bookshelf"));
      document.querySelector("#reading-end").addEventListener("click", () => { room.reading.end(); changed({ ok: true }); });
      document.querySelector("#reading-next").addEventListener("click", event => {
        if (!event.isTrusted) return;
        const sample = ["窗边的小树晃了晃叶子，像是在向屋里的人问好。", "有人把书翻过一页，阳光就停在那一页的边边上。", "他们没有急着读完故事，今天还有很长、很安静的下午。"];
        const reader = room.reading.session?.reader;
        const result = room.reading.line(reader, sample[this.lineIndex % sample.length]);
        if (result.ok) this.lineIndex++;
        changed(result);
      });
    }
    title(kind) {
      return {
        bookshelf: "Bookshelf · A quiet afternoon",
        "reading-invite": "Invite someone to listen to Yueyue",
        "reading-ask": "Ask someone to read to Yueyue",
        "reading-response": "An invitation to listen"
      }[kind];
    }
    options(kind) {
      if (kind === "bookshelf") return [
        { text: "Read on my own", run: () => this.start("alone") },
        { text: "Invite someone to listen", keepOpen: true, run: () => this.showMenu("reading-invite") },
        { text: "Ask someone to read", keepOpen: true, run: () => this.showMenu("reading-ask") }
      ];
      if (kind === "reading-invite" || kind === "reading-ask") {
        const mode = kind === "reading-invite" ? "invite" : "ask";
        return ["yan", "yu"].map(id => ({ text: `${mode === "invite" ? "Invite" : "Ask"} ${id === "yan" ? "Yan" : "Yu"}`, run: () => this.start(mode, id) }));
      }
      if (kind === "reading-response") return [
        { text: "Come and listen", run: event => this.respond(event, true) },
        { text: "Maybe later", run: event => this.respond(event, false) }
      ];
      return [];
    }
    start(mode, selected) {
      const result = this.room.reading.userStart(mode, selected);
      if (result.ok) this.lineIndex = 0;
      this.changed(result);
      return result;
    }
    companionOptions(actorId) {
      return [
        { text: "Read Aloud", run: () => this.room.command({ action: "read_aloud" }, Date.now(), actorId) },
        { text: "Invite Yueyue to Listen", run: () => this.room.command({ action: "invite_read" }, Date.now(), actorId) }
      ];
    }
    respond(event, accepted) {
      if (!event?.isTrusted) return { ok: false, error: "Please answer the invitation on the page." };
      return this.room.reading.respond("yueyue", this.requestId, accepted);
    }
    render(state, active) {
      const { session, invitation } = state.reading;
      const ready = session && session.participants.every(id => !state.actors[id].target);
      const names = { yueyue: "Yueyue", yan: "Yan", yu: "Yu" };
      const status = document.querySelector("#reading-status");
      status.hidden = !session && !invitation;
      status.textContent = invitation ? `Waiting for ${names[invitation.to]} to answer the invitation.` : !session ? "" : !ready ? "Finding a quiet reading spot…" : session.participants.length === 1 ? `${names[session.reader]} is reading by the bookshelf.` : `${names[session.reader]} is reading with ${session.reader === "yueyue" ? names[session.participants[1]] : "Yueyue"}.`;
      document.querySelector("#reading-end").hidden = !session && !invitation;
      document.querySelector("#reading-next").hidden = !active || !ready;
      this.userSpeech.render(active ? state.speeches.yueyue : null);
      if (active && invitation?.to === "yueyue" && this.requestId !== invitation.id) {
        this.requestId = invitation.id;
        this.showMenu("reading-response");
      }
      if (!invitation) this.requestId = null;
    }
  }
  window.ReadingView = ReadingView;
})();
