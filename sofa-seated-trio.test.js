const test = require("node:test");
const assert = require("node:assert/strict");
const trio = require("./sofa-seated-trio.js");
const geometry = require("./living-room-geometry.js");

function seated(seats = [1, 0, 2]) {
  return Object.fromEntries(["yueyue", "yan", "yu"].map((id, index) => [id, {
    id, seat: seats[index], posture: "sitting", screen: geometry.project(geometry.seats[seats[index]].foot)
  }]));
}

test("trio waits until all three distinct seats have settled", () => {
  for (const id of ["yueyue", "yan", "yu"]) {
    const actors = seated();
    for (const posture of ["walking", "standing"]) {
      actors[id].posture = posture;
      assert.equal(trio.layout(actors), null);
    }
  }
  assert.equal(trio.layout(seated([0, 0, 2])), null);
  const absent = seated();
  delete absent.yu;
  assert.equal(trio.layout(absent), null);
});

test("reference identity order is stable without rewriting any seat permutation", () => {
  for (const seats of [[0,1,2], [0,2,1], [1,0,2], [1,2,0], [2,0,1], [2,1,0]]) {
    const actors = seated(seats);
    const original = JSON.stringify(actors);
    const layout = trio.layout(actors);
    assert.ok(layout.positions.yueyue.x < layout.positions.yan.x);
    assert.ok(layout.positions.yan.x < layout.positions.yu.x);
    assert.equal(JSON.stringify(actors), original);
    for (const point of Object.values(layout.positions)) {
      assert.ok(point.x > layout.x - layout.width / 2 && point.x < layout.x + layout.width / 2);
    }
  }
});

test("right seat moves inward while its logical floor approach is unchanged", () => {
  assert.deepEqual(geometry.seats[2].approach, {u:.29, v:.82});
  const original = geometry.project({u:.20 - 3/28 + 1/95, v:.82 - 3/28 - 1/95});
  const current = geometry.project(geometry.seats[2].foot);
  assert.ok(current.x < original.x && current.y < original.y);
  assert.ok(original.x - current.x > 20 && original.x - current.x < 23);
});
