(function () {
  "use strict";
  const looks = [
    { id: "pajamas", name: "Cherry mornings", note: "The familiar little pajamas", src: "assets/living-room/yueyue-poses-upright.png", width: 2172, height: 724, cellWidth: 724, cellHeight: 724, body: { x: 167, y: 13, width: 502, height: 695 } },
    { id: "bridal", name: "A vow in bloom", note: "Pearls, lace and a little promise", src: "assets/wedding/wedding-sprites-v1.png", width: 1254, height: 1254, cellWidth: 627, cellHeight: 627, body: { x: 69, y: 67, width: 558, height: 516 } },
    { id: "princess", name: "Rose princess", note: "A crown, a rose and a soft pink dress", src: "assets/bedroom/yueyue-princess-sprites.png", width: 2172, height: 724, cellWidth: 543, cellHeight: 724, body: { x: 25, y: 24, width: 518, height: 656 } },
    ...[
      { id: "burgundy", name: "Cherry velvet", note: "Burgundy waves and familiar little bows", cellX: 0, cellWidth: 591, body: { x: 20, y: 16, width: 571, height: 854 } },
      { id: "midnight", name: "Midnight ribbons", note: "Soft black waves and a warm little smile", cellX: 591, cellWidth: 592, body: { x: 591, y: 16, width: 592, height: 854 } },
      { id: "rose", name: "Rose daydream", note: "Rose-pink waves and bunny slippers", cellX: 1183, cellWidth: 591, body: { x: 1183, y: 16, width: 573, height: 854 } }
    ].map(look => ({ ...look, src: "assets/bedroom/yueyue-hair-looks-v1.png", width: 1774, height: 887, cellHeight: 887 }))
  ];
  const actors = { yueyue: "Yueyue", yan: "Yan", yu: "Yu" };
  const defaults = {
    yan: { id: "default", name: "Cherry evenings", note: "Yan's familiar little sweater", src: "assets/living-room/yan-poses.png", width: 2172, height: 724, cellWidth: 724, cellHeight: 724, body: { x: 204, y: 11, width: 439, height: 701 } },
    yu: { id: "default", name: "Blue daydreams", note: "Yu's familiar little pajamas", src: "assets/living-room/yu-poses-v1.png", width: 2172, height: 724, cellWidth: 724, cellHeight: 724, body: { x: 219, y: 14, width: 428, height: 696 } }
  };
  window.WardrobeCatalog = Object.freeze({
    actors, reference: looks.find(look => look.id === "princess"),
    looks: actor => actor === "yueyue" ? looks : [defaults[actor]],
    defaultId: actor => actor === "yueyue" ? "pajamas" : "default"
  });
})();
