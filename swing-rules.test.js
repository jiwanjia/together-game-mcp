const { test } = require("node:test");
const assert = require("node:assert/strict");
const rules = require("./swing-rules.js");

test("first push is ready, grows swing and switches exactly one turn", () => {
  const start = rules.defaults();
  const result = rules.push(start, 1000, -1000);
  assert.equal(result.outcome, "good");
  assert.equal(result.state.moon, 14);
  assert.equal(result.state.player, 1);
  assert.ok(result.state.amplitude > start.amplitude);
  assert.equal(start.moon, 0);
});
test("middle return is ready, outer peak is not", () => {
  const swing = { ...rules.defaults(), started: true };
  assert.equal(rules.ready({ ...swing, phase: Math.PI }), true);
  assert.equal(rules.ready({ ...swing, phase: Math.PI / 2 }), false);
});
test("wrong timing preserves earned moon and switches turn", () => {
  const state = { ...rules.defaults(), started: true, moon: 28, phase: Math.PI / 2 };
  const result = rules.push(state, 2000, 0);
  assert.equal(result.outcome, "early");
  assert.equal(result.state.moon, 28);
  assert.equal(result.state.player, 1);
});
test("repeat push during cooldown does not change state or turn", () => {
  const state = rules.defaults();
  const result = rules.push(state, 1500, 1000);
  assert.equal(result.outcome, "ignored");
  assert.equal(result.state, state);
});
test("eight cooperative good pushes complete bounded moon and record height", () => {
  let state = rules.defaults();
  for (let i = 0; i < 8; i++) state = rules.push({ ...state, phase: 0 }, i * 1000, -1000).state;
  assert.equal(state.moon, 100);
  assert.equal(state.mode, "settling");
  assert.equal(state.best, state.height);
  assert.ok(state.amplitude <= .95);
  assert.equal(rules.push(state, 10000, 0).outcome, "ignored");
});
test("completion slows to stopped while keeping records and earned moon", () => {
  let state = { ...rules.defaults(), started: true, amplitude: .92, moon: 100, best: 118, height: 118, mode: "settling" };
  for (let i = 0; i < 200; i++) state = rules.step(state, .05);
  assert.equal(state.mode, "stopped");
  assert.equal(state.amplitude, 0);
  assert.equal(state.moon, 100);
  assert.equal(state.best, 118);
});
test("gentle mode has no scoring or turn changes and can return to play", () => {
  const start = { ...rules.defaults(), moon: 28, player: 1 };
  const gentle = rules.toggleGentle(start);
  assert.equal(gentle.mode, "gentle");
  assert.equal(rules.push(gentle, 1000, -1000).outcome, "ignored");
  const moved = rules.step(gentle, .05);
  assert.equal(moved.moon, 28);
  assert.equal(moved.player, 1);
  assert.equal(rules.toggleGentle(moved).mode, "play");
});
test("time step clamps long gaps instead of jumping across cycles", () => {
  const start = { ...rules.defaults(), started: true };
  assert.deepEqual(rules.step(start, 100), rules.step(start, .05));
  assert.equal(rules.step(rules.defaults(), .05).phase, 0);
});
