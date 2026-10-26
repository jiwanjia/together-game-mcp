(function (root) {
  "use strict";
  function splitVowLines(text) {
    const sentences = text.match(/[^。！？!?；;.\n]+[。！？!?；;.]?[”」’"]?|[。！？!?；;.]+/gu) || [];
    return sentences.flatMap(sentence => {
      const characters = Array.from(sentence.trim());
      const lines = [];
      for (let offset = 0; offset < characters.length; offset += 64) lines.push(characters.slice(offset, offset + 64).join(""));
      return lines;
    });
  }
  class WeddingCeremony {
    constructor(room, changed) {
      this.room = room;
      this.changed = changed;
      this.panel = document.querySelector("#wedding-vows");
      this.floor = document.querySelector("#wedding-floor");
      this.line = 0;
      this.bubbles = Object.fromEntries(["yueyue", "yan"].map(id => [id, document.querySelector(`#wedding-vow-bubble-${id}`)]));
      this.returnFocus = null;
      for (const id of ["yueyue", "yan"]) {
        const input = document.querySelector(`#wedding-vow-${id}`);
        input.value = room.drafts[id];
        input.addEventListener("input", () => {
          if (!room.draft(id, input.value)) input.value = room.drafts[id];
          this.changed();
        });
      }
      document.querySelector("#wedding-begin").addEventListener("click", () => this.open(false));
      document.querySelector("#wedding-replay").addEventListener("click", () => this.open(true));
      document.querySelector("#wedding-vows-next").addEventListener("click", () => {
        if (this.line + 1 < this.currentLines().length) this.line++;
        else { this.line = 0; room.next(); }
        this.changed();
      });
      document.querySelector("#wedding-vows-close").addEventListener("click", () => this.cancel());
      document.addEventListener("keydown", event => {
        if (event.key === "Escape" && this.room.ceremony) { event.preventDefault(); this.cancel(); }
      });
    }
    open(replay) {
      const result = this.room.begin(replay);
      if (!result.ok) return;
      this.line = 0;
      this.returnFocus = document.activeElement;
      this.changed();
      this.floor.scrollIntoView({ block: "center", behavior: "instant" });
      document.querySelector("#wedding-vows-next").focus({ preventScroll: true });
    }
    cancel() { this.room.ceremony = null; this.room.revision++; this.changed(); }
    passages() {
      const ceremony = this.room.ceremony;
      return [
        { title: "Before Our Vows", speaker: "烛光里的我们", text: "长廊尽头，彩窗的光落在礼服上。哥哥转过身，向月月伸出手。\n\n「月月，我们到这里啦。慢慢说，我在听。」" },
        { title: "Yueyue’s Vows", speaker: "月月", text: ceremony.vows.yueyue.trim() || "月月还没有写下誓词。\n\n可以先把心里的话留着，跳过这一页；也可以关闭剧情，亲手写好后再开始。" },
        { title: "Yan’s Vows", speaker: "哥哥", text: ceremony.vows.yan.trim() || "哥哥的誓词暂时留白。可以关闭剧情，修改初稿后再回来。" },
        { title: "A Moment Together", speaker: "月月 & 哥哥", text: "话音轻轻落下，身旁的烛火还在晃。\n\n哥哥把手留在月月面前，笑着看你。\n「接下来，想在这里再待一会儿，还是一起回家？」" }
      ];
    }
    currentLines() { return this.room.ceremony ? splitVowLines(this.passages()[this.room.ceremony.step].text) : []; }
    position(bubble, id) {
      const floor = this.floor.getBoundingClientRect();
      const actor = document.querySelector(`#wedding-${id}`).getBoundingClientRect();
      const text = bubble.querySelector(".room-speech-text");
      text.style.maxHeight = `${Math.max(28, Math.min(130, actor.top - floor.top - 48))}px`;
      const box = bubble.getBoundingClientRect();
      const headX = actor.left + actor.width / 2 - floor.left;
      const left = Math.max(8, Math.min(headX - box.width / 2, floor.width - box.width - 8));
      bubble.style.left = `${left}px`;
      bubble.style.top = `${Math.max(6, actor.top - floor.top - box.height - 5)}px`;
      bubble.style.setProperty("--speech-tail", `${Math.max(16, Math.min(headX - left, box.width - 16))}px`);
    }
    render(active) {
      const ceremony = active ? this.room.ceremony : null;
      const wasOpen = !this.panel.hidden;
      this.panel.hidden = !ceremony;
      for (const bubble of Object.values(this.bubbles)) bubble.hidden = true;
      if (!ceremony) {
        if (wasOpen && active && this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
        return;
      }
      const passages = this.passages();
      const passage = passages[ceremony.step];
      const lines = this.currentLines();
      const speaker = ceremony.step === 1 ? "yueyue" : "yan";
      const bubble = this.bubbles[speaker];
      bubble.hidden = false;
      bubble.querySelector(".room-speech-heading").textContent = speaker === "yueyue" ? "月月" : "哥哥";
      const text = bubble.querySelector(".room-speech-text");
      const value = lines[this.line] || "";
      if (text.textContent !== value) { text.textContent = value; text.scrollTop = 0; }
      document.querySelector("#wedding-vows-progress").textContent = `${ceremony.replay ? "Replay" : "Our Vows"} · ${ceremony.step + 1} / 4 · ${this.line + 1} / ${lines.length}`;
      document.querySelector("#wedding-vows-title").textContent = passage.title;
      const next = document.querySelector("#wedding-vows-next");
      next.textContent = this.line + 1 < lines.length ? "Next Line" : ceremony.step === 3 ? (ceremony.replay ? "Close Replay" : "Keep This Moment") :
        ceremony.step === 1 && !ceremony.vows.yueyue.trim() ? "Skip for Now" : "Continue";
      this.position(bubble, speaker);
    }
  }
  if (typeof module === "object" && module.exports) module.exports = { splitVowLines };
  else root.WeddingCeremony = WeddingCeremony;
})(typeof window === "undefined" ? globalThis : window);
