(function () {
  "use strict";
  const preview = location.search.includes("preview");
  let database;
  function open() {
    if (database) return database;
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open("playtogether-wardrobes-v2", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("wardrobes", { keyPath: "actor" });
      request.onerror = () => reject(new Error("Your wardrobe storage could not be opened."));
      request.onblocked = () => reject(new Error("Close other wardrobe tabs and try again."));
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
    return database;
  }
  async function load(actor) {
    if (preview) {
      const raw = sessionStorage.getItem(`playtogether-wardrobe-v2-${actor}`);
      return raw ? JSON.parse(raw) : null;
    }
    const db = await open();
    return new Promise((resolve, reject) => {
      const request = db.transaction("wardrobes").objectStore("wardrobes").get(actor);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error("Your saved wardrobe could not be read."));
    });
  }
  async function dataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("This image could not be saved."));
      reader.readAsDataURL(blob);
    });
  }
  async function save(record) {
    if (preview) {
      const looks = await Promise.all(record.looks.map(async look => ({
        ...look, data: typeof look.data === "string" ? look.data : await dataUrl(look.data)
      })));
      sessionStorage.setItem(`playtogether-wardrobe-v2-${record.actor}`, JSON.stringify({ ...record, looks }));
      return;
    }
    const db = await open();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("wardrobes", "readwrite");
      transaction.objectStore("wardrobes").put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(new Error("This look could not be saved. Your previous wardrobe is kept."));
    });
  }
  window.WardrobeStorage = Object.freeze({ load, save, preview });
})();
