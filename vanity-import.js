(function () {
  "use strict";
  const wardrobe = window.YueyueWardrobe;
  function connect({ view, actor, preview, reset, saved, status }) {
    const form = view.querySelector("#vanity-import");
    const fileInput = view.querySelector("#vanity-file");
    const nameInput = view.querySelector("#vanity-name");
    const confirm = view.querySelector("#vanity-import-save");
    let pending = null, generation = 0, saving = false;
    function cancel(restore = true) {
      if (saving) return;
      generation++;
      if (pending) URL.revokeObjectURL(pending.src);
      pending = null;
      form.reset();
      form.hidden = true;
      if (restore) reset();
    }
    view.querySelector("#vanity-add").addEventListener("click", () => {
      cancel(false);
      form.hidden = false;
      view.querySelector("#vanity-import-owner").textContent = "For " + wardrobe.actors[actor()];
      confirm.disabled = true;
      status("Choose one full-body PNG. A transparent background works best.");
      fileInput.focus({ preventScroll: true });
    });
    fileInput.addEventListener("change", async () => {
      const token = ++generation;
      if (pending) URL.revokeObjectURL(pending.src);
      pending = null;
      confirm.disabled = true;
      reset();
      if (!fileInput.files[0]) return;
      status("Opening your look…");
      try {
        const image = await window.WardrobeImport.inspect(fileInput.files[0]);
        if (token !== generation) { URL.revokeObjectURL(image.src); return; }
        pending = { ...image, id: "custom-" + crypto.randomUUID(), name: "A new look", note: "Your own little find" };
        preview(pending);
        confirm.disabled = false;
        status("Try a name, then keep this look when you are ready.");
      } catch (error) { if (token === generation) status(error.message); }
    });
    nameInput.addEventListener("input", () => {
      if (!pending) return;
      pending.name = nameInput.value.trim() || "A new look";
      preview(pending);
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!pending || saving || !form.reportValidity()) return;
      pending.name = nameInput.value.trim();
      if (!pending.name) { status("Give this look a name."); nameInput.focus(); return; }
      saving = true;
      view.inert = true;
      try {
        const result = await wardrobe.add(actor(), pending);
        if (!result.ok) { status(result.error); return; }
        pending = null; // The wardrobe now owns this object URL.
        saving = false;
        cancel(false);
        saved();
        status("Your new look is kept. ♡");
      } finally { saving = false; view.inert = false; }
    });
    view.querySelector("#vanity-import-cancel").addEventListener("click", () => {
      cancel();
      status("");
      view.querySelector("#vanity-add").focus({ preventScroll: true });
    });
    form.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); view.querySelector("#vanity-import-cancel").click(); }
    });
    return { cancel, isOpen: () => !form.hidden };
  }
  window.VanityImport = Object.freeze({ connect });
})();
