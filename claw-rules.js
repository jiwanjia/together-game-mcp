/* Game rules are independent of the browser and animation speed. */
(function (root) {
  const toys = [
    { name: "云朵兔", emoji: "🐰", weight: 0.8, grip: 1.0, width: 11, hint: "轻轻的，耳朵好勾住" },
    { name: "草莓猫", emoji: "🐱", weight: 1.0, grip: 0.94, width: 10, hint: "对准肚子，别只夹到尾巴" },
    { name: "蜂蜜熊", emoji: "🐻", weight: 1.5, grip: 0.91, width: 12, hint: "圆滚滚有点重，要夹正中心" },
    { name: "星星狐", emoji: "🦊", weight: 1.1, grip: 0.91, width: 9, hint: "尖耳朵灵巧，身体比较窄" },
    { name: "月光企鹅", emoji: "🐧", weight: 1.2, grip: 0.96, width: 10, hint: "圆肚皮滑滑的，正中更稳" },
  ];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function targetAt(x, positions, caught) {
    let nearest = null;
    toys.forEach((toy, index) => {
      if (caught.includes(toy.name)) return;
      const distance = Math.abs(positions[index] - x);
      if (!nearest || distance < nearest.distance) nearest = { toy, index, distance };
    });
    return nearest;
  }

  function planGrab(x, positions, caught, random = Math.random) {
    const target = targetAt(x, positions, caught);
    if (!target || target.distance >= target.toy.width) return { kind: "miss" };
    const accuracy = 1 - target.distance / target.toy.width;
    const breeze = (random() - 0.5) * 0.08;
    const grip = target.toy.grip * accuracy - target.toy.weight * 0.22;
    const sway = 0.12 + Math.abs(86 - x) / 100 * 0.08 + (1 - accuracy) * 0.1;
    const stability = grip - sway + breeze;
    if (stability >= 0.18) return { kind: "catch", target, grip, stability };
    return {
      kind: "slip", target, grip, stability,
      slipAt: clamp(0.25 + stability * 1.5, 0.15, 0.72),
      drift: (random() - 0.5) * 18,
    };
  }

  function landingAt(x, drift, positions, caught, index) {
    const occupied = positions.filter((_, other) => other !== index && !caught.includes(toys[other].name));
    let landing = clamp(x + drift, 10, 90);
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (occupied.every(position => Math.abs(position - landing) >= 8)) return landing;
      landing = 10 + attempt;
    }
    return clamp(x, 10, 90);
  }

  const api = { toys, clamp, targetAt, planGrab, landingAt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ClawRules = api;
})(globalThis);
