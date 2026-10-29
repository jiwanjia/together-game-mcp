(function () {
  "use strict";
  const catalog = window.WardrobeCatalog, storage = window.WardrobeStorage;
  const records = {}, errors = {}, urls = [];
  let busy = false, spriteId = 0;
  function validLook(look) {
    const body = look?.body;
    return look && typeof look.id === "string" && look.id.startsWith("custom-") &&
      typeof look.name === "string" && look.name.trim().length > 0 && look.name.length <= 60 &&
      [look.width, look.height, body?.width, body?.height].every(value => Number.isFinite(value) && value > 0 && value <= 4096) &&
      [body.x, body.y].every(value => Number.isFinite(value) && value >= 0) &&
      body.x + body.width <= look.width && body.y + body.height <= look.height &&
      (look.data instanceof Blob || (typeof look.data === "string" && look.data.startsWith("data:image/png;base64,")));
  }
  function looks(actor = "yueyue") {
    return [...catalog.looks(actor), ...(records[actor]?.looks || [])];
  }
  function current(actor = "yueyue") { return records[actor]?.selected || catalog.defaultId(actor); }
  function hydrate(record) {
    for (const look of record.looks) {
      look.cellWidth = look.width;
      look.cellHeight = look.height;
      look.src = typeof look.data === "string" ? look.data : URL.createObjectURL(look.data);
      if (look.data instanceof Blob) urls.push(look.src);
    }
    return record;
  }
  function apply() {
    for (const actor of Object.keys(catalog.actors)) {
      const selected = current(actor);
      for (const prefix of ["room", "bedroom"]) {
        const element = document.querySelector("#" + prefix + "-" + actor);
        if (!element) continue;
        element.querySelector(".wardrobe-art")?.remove();
        element.dataset.outfit = selected;
        element.dataset.customLook = String(selected !== catalog.defaultId(actor));
        if (selected !== catalog.defaultId(actor)) {
          const look = looks(actor).find(look => look.id === selected);
          element.append(sprite(look, "wardrobe-art", selected.startsWith("custom-"), actor));
        }
      }
    }
  }
  function sprite(lookOrId, className = "", normalize = false, actor = "yueyue") {
    const look = typeof lookOrId === "string" ? looks(actor).find(item => item.id === lookOrId) : lookOrId;
    const frame = normalize ? catalog.reference : look;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + frame.cellWidth + " " + frame.cellHeight);
    svg.setAttribute("preserveAspectRatio", "xMidYMax meet");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", className);
    const clip = document.createElementNS(ns, "clipPath");
    clip.id = "wardrobe-frame-" + ++spriteId;
    const bounds = document.createElementNS(ns, "rect");
    bounds.setAttribute("x", look.cellX || 0);
    bounds.setAttribute("width", look.cellWidth);
    bounds.setAttribute("height", look.cellHeight);
    clip.append(bounds);
    svg.append(clip);
    const image = document.createElementNS(ns, "image");
    for (const [key, value] of Object.entries({ href: look.src, width: look.width, height: look.height, "clip-path": "url(#" + clip.id + ")" })) {
      image.setAttribute(key, value);
    }
    const group = document.createElementNS(ns, "g");
    let scale = 1, x = -(look.cellX || 0), y = 0;
    if (normalize) {
      // Preserve the six approved presets' common height; fit unusually wide imports in full.
      scale = frame.body.height / look.body.height;
      if (look.id.startsWith("custom-")) scale = Math.min(scale, frame.body.width / look.body.width);
      x = frame.body.x + frame.body.width / 2 - (look.body.x + look.body.width / 2) * scale;
      y = frame.body.y + frame.body.height - (look.body.y + look.body.height) * scale;
    }
    group.setAttribute("transform", "translate(" + x + " " + y + ") scale(" + scale + ")");
    group.append(image);
    svg.append(group);
    return svg;
  }
  const ready = (async () => {
    await Promise.all(Object.keys(catalog.actors).map(async actor => {
      records[actor] = { version: 2, actor, selected: catalog.defaultId(actor), looks: [] };
      try {
        const saved = await storage.load(actor);
        if (saved) {
          if (saved.version !== 2 || saved.actor !== actor || !Array.isArray(saved.looks) ||
              !saved.looks.every(validLook) || new Set(saved.looks.map(look => look.id)).size !== saved.looks.length ||
              ![...catalog.looks(actor), ...saved.looks].some(look => look.id === saved.selected)) {
            throw new Error("Your saved wardrobe could not be loaded. The original record is kept.");
          }
          records[actor] = hydrate(saved);
        } else if (actor === "yueyue") {
          const old = (storage.preview ? sessionStorage : localStorage).getItem("playtogether-wardrobe-v1");
          if (old) {
            const legacy = JSON.parse(old);
            if (legacy.version !== 1 || !catalog.looks(actor).some(look => look.id === legacy.outfit)) throw new Error("Your saved look could not be loaded. The original record is kept.");
            records[actor].selected = legacy.outfit;
          }
        }
      } catch (_) { errors[actor] = "Your saved wardrobe could not be loaded. The original record is kept."; }
    }));
    apply();
  })();
  async function save(actor, id, imported) {
    await ready;
    if (!catalog.actors[actor]) return { ok: false, error: "Choose a character." };
    if (errors[actor]) return { ok: false, error: errors[actor] };
    if (busy) return { ok: false, error: "A look is still being saved." };
    const next = { ...records[actor], looks: [...records[actor].looks] };
    if (imported) {
      if (!validLook(imported)) return { ok: false, error: "Choose a valid PNG and a name up to 60 characters." };
      next.looks.push(imported);
    }
    if (![...catalog.looks(actor), ...next.looks].some(look => look.id === id)) return { ok: false, error: "Choose a look from this wardrobe." };
    next.selected = id;
    busy = true;
    try {
      const stored = { ...next, looks: next.looks.map(({ src, cellWidth, cellHeight, ...look }) => look) };
      await storage.save(stored);
      records[actor] = next;
      if (imported) urls.push(imported.src);
      apply();
      document.dispatchEvent(new CustomEvent("wardrobe-change", { detail: actor }));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.name === "QuotaExceededError" ? "This browser is full. Your previous wardrobe is kept." : error.message || "This look could not be saved. Your previous wardrobe is kept." };
    } finally { busy = false; }
  }
  window.addEventListener("pagehide", event => { if (!event.persisted) urls.forEach(url => URL.revokeObjectURL(url)); });
  window.YueyueWardrobe = Object.freeze({ ready, actors: catalog.actors, looks, current, sprite, apply,
    message: actor => errors[actor || "yueyue"] || "",
    wear: (id, actor = "yueyue") => save(actor, id),
    add: (actor, look) => save(actor, look.id, look)
  });
})();
