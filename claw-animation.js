/* Animation consumes a resolved turn; it never awards prizes itself. */
window.ClawAnimation = function (claw, machineWindow, isPaused) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const ease = value => value * value * (3 - 2 * value);
  let depth = 64;
  let x = 50;

  function pose(nextX, nextDepth) {
    x = nextX;
    depth = nextDepth;
    claw.style.left = `${x}%`;
    claw.style.setProperty("--depth", `${depth}px`);
  }

  function tween(duration, update) {
    const milliseconds = reducedMotion.matches ? Math.min(duration, 180) : duration;
    return new Promise(resolve => {
      let elapsed = 0;
      let previous = performance.now();
      function frame(now) {
        if (!isPaused()) {
          elapsed += Math.min(now - previous, 50);
          const progress = Math.min(elapsed / milliseconds, 1);
          update(ease(progress), progress);
          if (progress === 1) { resolve(); return; }
        }
        previous = now;
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  async function play(startX, result, prize, message) {
    const floor = machineWindow.clientHeight - 125;
    pose(startX, 64);
    claw.classList.remove("is-closed");
    message("爪子慢慢往下走……");
    await tween(850, progress => pose(startX, 64 + (floor - 64) * progress));
    claw.classList.add("is-closed");
    message(result.kind === "miss" ? "差一点，爪子没有夹到娃娃。" : "夹住了！先别松，慢慢提起来……");
    await tween(350, () => {});
    await tween(1000, (progress, time) => {
      pose(startX, floor - (floor - 64) * progress);
      if (prize) {
        prize.style.setProperty("--lift", `${-(floor - depth)}px`);
        prize.style.setProperty("--tilt", `${Math.sin(time * Math.PI * 3) * 6}deg`);
      }
    });
    if (!prize) {
      await tween(450, progress => pose(startX + (86 - startX) * progress, 64));
      return;
    }
    message("往出口走啦……娃娃有一点晃，稳住！");
    const transportFraction = result.kind === "slip" ? result.slipAt : 1;
    await tween(1900 * transportFraction, (progress, time) => {
      const travel = ease(time * transportFraction);
      pose(startX + (86 - startX) * travel, 64);
      const wiggle = Math.sin(time * Math.PI * 7) * (result.kind === "slip" ? 2.5 : 1.2);
      prize.style.left = `${x + wiggle}%`;
      prize.style.setProperty("--tilt", `${wiggle * 6}deg`);
    });
    claw.classList.remove("is-closed");
    if (result.kind === "slip") {
      message("啊，滑到爪尖了……掉下去了！下一轮还能接着抓。");
      const releaseX = x;
      const landing = ClawRules.landingAt(releaseX, result.drift, result.positions, result.caught, result.target.index);
      const from = parseFloat(prize.style.left);
      await tween(650, progress => {
        pose(releaseX + (86 - releaseX) * progress, 64);
        prize.style.left = `${from + (landing - from) * progress}%`;
        prize.style.setProperty("--lift", `${-(floor - 64) * (1 - progress)}px`);
        prize.style.setProperty("--tilt", `${12 * (1 - progress)}deg`);
      });
      return landing;
    }
    message("到出口了，轻轻放下来……");
    await tween(550, progress => {
      prize.style.setProperty("--lift", `${-(floor - 64) * (1 - progress)}px`);
      prize.style.opacity = String(1 - progress);
    });
  }
  return { pose, play };
};
