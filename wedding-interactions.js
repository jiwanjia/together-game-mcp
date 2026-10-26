(function () {
  "use strict";
  class WeddingInteractions {
    constructor(room, changed) {
      this.room = room;
      this.changed = changed;
      this.menu = document.querySelector("#wedding-menu");
      this.openers = [document.querySelector("#wedding-yan"), document.querySelector("#wedding-interact")];
      this.returnFocus = this.openers[0];
      for (const opener of this.openers) opener.addEventListener("click", () => this.open(opener));
      const actions = {
        "#wedding-menu-come": () => room.command({ action: "come" }),
        "#wedding-menu-follow": () => room.following ? room.stopFollow() : room.follow(),
        "#wedding-menu-face": () => room.command({ action: "face", direction: "yueyue" })
      };
      for (const [selector, action] of Object.entries(actions)) {
        document.querySelector(selector).addEventListener("click", () => {
          const result = action();
          this.close(true);
          changed(result);
        });
      }
      document.querySelector("#wedding-menu-close").addEventListener("click", () => this.close(true));
      document.querySelector("#wedding-stop-follow").addEventListener("click", () => changed(room.stopFollow()));
      document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !this.menu.hidden) { event.preventDefault(); this.close(true); }
      });
    }
    open(opener) {
      if (this.room.ceremony) return;
      this.returnFocus = opener;
      this.menu.hidden = false;
      this.render(true);
      this.menu.scrollIntoView({ block: "nearest", behavior: "instant" });
      document.querySelector("#wedding-menu-come").focus({ preventScroll: true });
    }
    close(restoreFocus = false) {
      this.menu.hidden = true;
      for (const opener of this.openers) opener.setAttribute("aria-expanded", "false");
      if (restoreFocus && this.returnFocus.isConnected) this.returnFocus.focus({ preventScroll: true });
    }
    render(active) {
      if (!active || this.room.ceremony) this.close();
      document.querySelector("#wedding-menu-follow").textContent = this.room.following ? "Stop Following" : "Follow Yueyue";
      document.querySelector("#wedding-stop-follow").hidden = !this.room.following;
      for (const opener of this.openers) opener.setAttribute("aria-expanded", String(!this.menu.hidden));
    }
  }
  window.WeddingInteractions = WeddingInteractions;
})();
