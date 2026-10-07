(function (root) {
  "use strict";
  const obstacles = [
    { name: "沙发", u0: .02, u1: .24, v0: .30, v1: .91 },
    { name: "茶几", u0: .34, u1: .55, v0: .38, v1: .63 },
    { name: "书柜", u0: .02, u1: .20, v0: .02, v1: .29 },
    { name: "窗边花盆", u0: .82, u1: .98, v0: .02, v1: .14 },
    { name: "灯边桌", u0: .02, u1: .23, v0: .92, v1: .99 }
  ];
  const seats = [.39, .61, .82].map((v, index) => ({
    id: index, name: ["左座", "中座", "右座"][index],
    approach: { u: .29, v },
    // The sofa cushions rise above the floor and recede along the right wall.
    foot: { u: .20 - (index + 1) / 28 + 1 / 95, v: v - (index + 1) / 28 - 1 / 95 }
  }));
  function project({ u, v }) { return { x: 500 + (v - u) * 475, y: 370 + (u + v) * 280 }; }
  function unproject({ x, y }) {
    const sum = (y - 370) / 280;
    const difference = (x - 500) / 475;
    return { u: (sum - difference) / 2, v: (sum + difference) / 2 };
  }
  function walkable(point) {
    if (!point || !Number.isFinite(point.u) || !Number.isFinite(point.v)) return false;
    if (point.u < .055 || point.u > .945 || point.v < .055 || point.v > .945) return false;
    return !obstacles.some(box => point.u > box.u0 - .012 && point.u < box.u1 + .012 &&
      point.v > box.v0 - .012 && point.v < box.v1 + .012);
  }
  function distance(a, b) { return Math.hypot(a.u - b.u, a.v - b.v); }
  function clearSegment(a, b) {
    const samples = Math.ceil(distance(a, b) / .008);
    for (let step = 0; step <= samples; step++) {
      const ratio = samples ? step / samples : 0;
      if (!walkable({ u: a.u + (b.u - a.u) * ratio, v: a.v + (b.v - a.v) * ratio })) return false;
    }
    return true;
  }
  // Search a small floor grid, then remove corners with a clear line of travel.
  function findPath(start, target) {
    if (!walkable(start) || !walkable(target)) return null;
    if (clearSegment(start, target)) return [{ ...target }];
    const grid = [];
    for (let u = 3; u <= 37; u++) {
      for (let v = 3; v <= 37; v++) {
        const point = { u: u / 40, v: v / 40 };
        if (walkable(point)) grid.push({ ...point, key: `${u},${v}`, gu: u, gv: v });
      }
    }
    const nearest = grid.filter(point => clearSegment(start, point))
      .sort((a, b) => distance(start, a) - distance(start, b))[0];
    if (!nearest) return null;
    const nodes = new Map(grid.map(point => [point.key, point]));
    const previous = new Map([[nearest.key, null]]);
    const queue = [nearest];
    let end = null;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor];
      if (clearSegment(current, target)) { end = current; break; }
      for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = nodes.get(`${current.gu + du},${current.gv + dv}`);
        if (!next || previous.has(next.key) || !clearSegment(current, next)) continue;
        previous.set(next.key, current.key);
        queue.push(next);
      }
    }
    if (!end) return null;
    const corners = [{ ...target }];
    for (let key = end.key; key !== null; key = previous.get(key)) corners.unshift(nodes.get(key));
    const path = [];
    let anchor = start;
    for (let index = 0; index < corners.length;) {
      let next = corners.length - 1;
      while (next > index && !clearSegment(anchor, corners[next])) next--;
      path.push({ u: corners[next].u, v: corners[next].v });
      anchor = corners[next];
      index = next + 1;
    }
    return path;
  }
  function beside(point) {
    return [{ u: point.u + .17, v: point.v }, { u: point.u, v: point.v + .17 },
      { u: point.u - .17, v: point.v }, { u: point.u, v: point.v - .17 }].find(walkable);
  }
  const api = { obstacles, seats, project, unproject, walkable, distance, clearSegment, findPath, beside };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LivingRoomGeometry = api;
})(typeof window === "undefined" ? globalThis : window);
