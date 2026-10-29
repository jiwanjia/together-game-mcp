(async function () {
  "use strict";
  const wardrobe = window.YueyueWardrobe;
  const view = document.querySelector("#vanity-view");
  // Keep this entry independent of the unfinished pair-rest changes.
  if (!document.querySelector("#bedroom-vanity")) {
    document.querySelector("#bedroom-floor").insertAdjacentHTML("beforeend", '<button id="bedroom-vanity" class="room-furniture-hotspot bedroom-vanity-hotspot" type="button" aria-label="Yueyue’s Vanity"><span>Yueyue’s Vanity</span></button>');
    document.querySelector(".bedroom-notes").insertAdjacentHTML("beforeend", '<button id="bedroom-open-vanity" class="room-button" type="button">Yueyue’s Vanity</button>');
  }
  view.innerHTML = `<header class="vanity-heading"><button id="vanity-back" class="text-button" type="button">← Back to Bedroom</button><p class="eyebrow">Our home · The dressing room</p><span class="vanity-small-rose" aria-hidden="true">❀ ♡</span></header>
    <div class="vanity-layout"><section class="vanity-dressing" aria-labelledby="vanity-title"><p class="vanity-script">a little moment, just for you</p><h1 id="vanity-title">Yueyue’s Vanity</h1>
      <div class="vanity-mirror-space"><div class="vanity-glass"></div><div id="vanity-reflection" class="vanity-reflection"></div><img class="vanity-frame" src="assets/bedroom/vanity-mirror-frame-v1.png" alt="" draggable="false"><span class="vanity-mirror-signature" aria-hidden="true">♡</span></div>
      <p class="vanity-whisper">There is no hurry to be anyone else. <span aria-hidden="true">✧</span></p></section>
    <section class="vanity-wardrobe" aria-labelledby="wardrobe-title"><p class="eyebrow">The little wardrobe</p><h2 id="wardrobe-title">What feels like you today?</h2><p class="vanity-intro">A familiar little outfit, or something you found yourself.</p>
      <div id="vanity-actors" class="vanity-actors" role="group" aria-label="Choose a character"></div>
      <div class="vanity-closet-heading"><p id="vanity-owner"></p><button id="vanity-add" type="button" class="vanity-add" disabled>＋ Add a look</button></div>
      <form id="vanity-import" class="vanity-import" hidden aria-label="Add a look"><p id="vanity-import-owner" class="eyebrow"></p><label for="vanity-file">Your character PNG</label><input id="vanity-file" type="file" accept="image/png,.png"><p class="vanity-file-help">One character · PNG up to 4 MB · up to 4096 × 4096 pixels. Your image stays in this browser.</p><label for="vanity-name">Look name</label><input id="vanity-name" type="text" maxlength="60" required autocomplete="off" placeholder="A little name you love"><div class="vanity-import-actions"><button id="vanity-import-cancel" class="text-button" type="button">Cancel</button><button id="vanity-import-save" class="vanity-primary" type="submit" disabled>Keep this new look ♡</button></div></form>
      <div id="vanity-looks" class="vanity-looks" role="group" aria-label="Choose a look"></div>
      <div class="vanity-choice"><span class="vanity-choice-mark" aria-hidden="true">✦</span><div><p class="eyebrow">In the mirror</p><h3 id="vanity-look-name"></h3><p id="vanity-look-note"></p></div><span id="vanity-kept" class="vanity-kept">Kept ♡</span></div>
      <button id="vanity-wear" class="vanity-primary" type="button" disabled>Keep this look ♡</button><p id="vanity-status" class="vanity-status" role="status" aria-live="polite">Opening your wardrobe…</p><p class="vanity-footnote">A little wardrobe for each of us. Reading and bedtime pictures keep their familiar clothes. <span aria-hidden="true">❀</span></p>
    </section></div>`;
  let actor = "yueyue", draft, imported = null, ready = false;
  const status = text => { view.querySelector("#vanity-status").textContent = text; };
  if (window.WardrobeStorage.preview) view.querySelector(".vanity-file-help").append(" Preview storage has a smaller capacity.");
  function renderMirror(look) {
    view.querySelector("#vanity-reflection").replaceChildren(wardrobe.sprite(look, "vanity-portrait", true, actor));
    view.querySelector("#vanity-look-name").textContent = look.name;
    view.querySelector("#vanity-look-note").textContent = look.note || "Your own little find";
    view.querySelector("#vanity-kept").hidden = look.id !== wardrobe.current(actor);
    view.querySelector("#vanity-wear").disabled = !ready || Boolean(imported) || Boolean(wardrobe.message(actor));
    view.querySelector("#vanity-wear").textContent = look.id === wardrobe.current(actor) ? "Keep this look ♡" : "Wear this look ♡";
    for (const card of view.querySelectorAll(".vanity-look")) card.setAttribute("aria-pressed", String(card.dataset.look === look.id));
  }
  function reset() {
    imported = null;
    draft = wardrobe.current(actor);
    renderMirror(wardrobe.looks(actor).find(look => look.id === draft));
  }
  function renderCloset() {
    const owner = wardrobe.actors[actor];
    view.querySelector("#vanity-title").textContent = owner + "’s Vanity";
    view.querySelector("#vanity-owner").textContent = owner + "’s little collection";
    for (const button of view.querySelectorAll("[data-actor]")) button.setAttribute("aria-pressed", String(button.dataset.actor === actor));
    const list = view.querySelector("#vanity-looks");
    list.replaceChildren();
    for (const look of wardrobe.looks(actor)) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "vanity-look";
      card.dataset.look = look.id;
      card.setAttribute("aria-pressed", String(look.id === draft));
      card.append(wardrobe.sprite(look, "vanity-thumbnail", true, actor));
      const title = document.createElement("span");
      title.textContent = look.name;
      card.append(title);
      card.addEventListener("click", () => {
        importer.cancel(false);
        imported = null;
        draft = look.id;
        renderMirror(look);
        status(wardrobe.message(actor));
      });
      list.append(card);
    }
    reset();
    view.querySelector("#vanity-add").disabled = Boolean(wardrobe.message(actor));
    status(wardrobe.message(actor));
  }
  const importer = window.VanityImport.connect({ view, actor: () => actor,
    preview: look => { imported = look; renderMirror(look); }, reset, saved: renderCloset, status });
  for (const [id, name] of Object.entries(wardrobe.actors)) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.actor = id;
    button.textContent = name;
    button.setAttribute("aria-pressed", String(id === actor));
    button.disabled = true;
    button.addEventListener("click", () => {
      importer.cancel(false);
      actor = id;
      renderCloset();
    });
    view.querySelector("#vanity-actors").append(button);
  }
  view.querySelector("#vanity-wear").addEventListener("click", async () => {
    view.inert = true;
    try {
      const result = await wardrobe.wear(draft, actor);
      renderCloset();
      status(result.ok ? "Your look is kept here. ♡" : result.error);
    } finally { view.inert = false; }
  });
  view.querySelector("#vanity-back").addEventListener("click", () => window.ParkNavigation.show("bedroom"));
  for (const id of ["bedroom-vanity", "bedroom-open-vanity"]) document.getElementById(id)?.addEventListener("click", () => window.ParkNavigation.show("vanity"));
  document.addEventListener("park-view-change", event => {
    importer.cancel(false);
    if (ready && event.detail === "vanity") renderCloset();
  });
  await wardrobe.ready;
  ready = true;
  for (const button of view.querySelectorAll("[data-actor]")) button.disabled = false;
  renderCloset();
})();
