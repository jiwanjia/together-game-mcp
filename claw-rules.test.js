const { test } = require("node:test");
const assert = require("node:assert/strict");
const { toys, planGrab, targetAt, landingAt } = require("./claw-rules.js");
const positions = [14, 32, 50, 68, 86];

test("each toy can be caught at its center, even in the worst small breeze", () => {
  positions.forEach(x => assert.equal(planGrab(x, positions, [], () => 0).kind, "catch"));
});
test("an off-center grip slips while a centered grip on the same toy holds", () => {
  assert.equal(planGrab(50, positions, [], () => .5).kind, "catch");
  const result = planGrab(56, positions, [], () => .5);
  assert.equal(result.kind, "slip");
  assert.equal(result.target.toy.name, "蜂蜜熊");
  assert.ok(result.slipAt >= .15 && result.slipAt <= .72);
});
test("collected animals and gaps produce an empty claw", () => {
  assert.equal(planGrab(50, positions, toys.map(toy => toy.name), () => .5).kind, "miss");
  const caught = toys.filter(toy => toy.name !== "云朵兔").map(toy => toy.name);
  assert.equal(planGrab(90, positions, caught, () => .5).kind, "miss");
  assert.equal(targetAt(50, positions, caught).toy.name, "云朵兔");
});
test("heavy bear has less stability than light rabbit at equal relative accuracy", () => {
  const rabbit = planGrab(14, positions, [], () => .5);
  const bear = planGrab(50, positions, [], () => .5);
  assert.ok(rabbit.stability > bear.stability);
});
test("small breeze cannot make a central grip randomly fail", () => {
  [0, .1, .5, .9, 1].forEach(random => {
    assert.equal(planGrab(50, positions, [], () => random).kind, "catch");
    assert.equal(planGrab(56, positions, [], () => random).kind, "slip");
  });
});
test("slipped animals stay within the machine and apart from remaining animals", () => {
  [-100, 10, 31, 50, 69, 90, 200].forEach(x => {
    [-30, 0, 30].forEach(drift => {
      const landing = landingAt(x, drift, positions, [], 2);
      assert.ok(landing >= 10 && landing <= 90);
      positions.forEach((position, index) => {
        if (index !== 2) assert.ok(Math.abs(position - landing) >= 8);
      });
    });
  });
});
