(function (root) {
  "use strict";
  const floor = typeof module === "object" && module.exports ? require("./living-room-geometry.js") : root.LivingRoomGeometry;
  const furniture = [
    { name: "Bed", u0: .24, u1: .90, v0: .02, v1: .43 },
    { name: "Vanity", u0: .02, u1: .28, v0: .68, v1: .98 }
  ];
  const bedside = { yan: { u: .78, v: .49 }, yueyue: { u: .55, v: .49 }, yu: { u: .32, v: .49 } };
  const heads = { yan: { x: 204, y: 456 }, yueyue: { x: 263, y: 423 }, yu: { x: 330, y: 388 } };
  function project({ u, v }) { return { x: 500 + (v - u) * 480, y: 360 + (u + v) * 300 }; }
  function unproject({ x, y }) {
    const sum = (y - 360) / 300;
    const difference = (x - 500) / 480;
    return { u: (sum - difference) / 2, v: (sum + difference) / 2 };
  }
  function walkable(point) {
    if (!point || !Number.isFinite(point.u) || !Number.isFinite(point.v) ||
        point.u < .055 || point.u > .945 || point.v < .055 || point.v > .945) return false;
    return !furniture.some(box => point.u > box.u0 - .015 && point.u < box.u1 + .015 &&
      point.v > box.v0 - .015 && point.v < box.v1 + .015);
  }
  function beside(point) {
    return [{ u: point.u + .18, v: point.v }, { u: point.u, v: point.v + .18 },
      { u: point.u - .18, v: point.v }, { u: point.u, v: point.v - .18 }].find(walkable);
  }
  const api = { project, unproject, walkable, beside, bedside, heads, furniture,
    distance: floor.distance, findPath: (start, target) => floor.findPath(start, target, walkable) };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BedroomGeometry = api;
})(typeof window === "undefined" ? globalThis : window);
