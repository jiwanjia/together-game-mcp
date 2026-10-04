(function () {
  const view = document.querySelector("#swing-view");
  const scene = document.querySelector(".swing-scene");
  const pushButton = document.querySelector("#push-swing");
  const gentleButton = document.querySelector("#gentle-swing");
  const status = document.querySelector("#swing-status");
  const timing = document.querySelector("#swing-timing-label");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const store = SwingStorage(text => { document.querySelector("#swing-save-status").textContent = text; });
  const players = ["月月", "砚"];
  let swing = store.load();
  let lastPush = -1000;
  let frame = 0;
  let previous = 0;

  function renderMotion(now) {
    const amplitude = swing.mode === "gentle" ? .08 : swing.amplitude;
    const angle = Math.sin(swing.phase) * amplitude * (reduced.matches ? .25 : 1);
    document.querySelector("#swing-rig").setAttribute("transform", `translate(500 110) rotate(${angle * 180 / Math.PI})`);
    document.querySelector("#swing-shadow").setAttribute("cx", String(500 - Math.sin(angle) * 340));
    document.querySelector("#swing-timing-dot").style.left = `${50 + Math.sin(swing.phase) * 45}%`;
    const cooling = now - lastPush < 800;
    const ready = SwingRules.ready(swing) && !cooling;
    timing.dataset.ready = String(ready);
    scene.classList.toggle("is-ready", ready);
    pushButton.disabled = swing.mode !== "play" || cooling;
    gentleButton.disabled = swing.mode === "settling";
    let text = ready ? "现在可以推 · 光点回到绿色中间啦" : "等它回摆 · 绿色中间是好时机";
    if (!swing.started && swing.mode === "play") text = "现在可以推 · 从轻轻的一下开始";
    if (cooling && swing.mode === "play") text = "刚推过啦 · 等秋千轻轻回摆";
    if (swing.mode === "gentle") text = "慢慢摇 · 这一刻不计分，也不换人";
    if (swing.mode === "settling") text = "攒满了 · 秋千正在慢慢停下来";
    if (swing.mode === "stopped") text = "月光留念 · 星星已经挂在绳子上";
    if (timing.textContent !== text) timing.textContent = text;
  }

  function renderProgress() {
    const moon = document.querySelector("#swing-moon");
    moon.textContent = `${swing.moon}%`;
    moon.setAttribute("aria-valuenow", String(swing.moon));
    document.querySelector("#moon-ring").style.strokeDashoffset = String(301.6 * (1 - swing.moon / 100));
    document.querySelector("#swing-player").textContent = players[swing.player];
    pushButton.textContent = `${players[swing.player]}推一把`;
    gentleButton.textContent = swing.mode === "gentle" ? (swing.moon === 100 ? "回到月光留念" : "回到配合") : "慢慢摇";
    document.querySelector("#swing-height").textContent = `${swing.height} cm`;
    document.querySelector("#swing-best").textContent = `${swing.best} cm`;
    document.querySelector("#swing-petals").setAttribute("visibility", swing.moon >= 28 ? "visible" : "hidden");
    document.querySelector("#swing-stars").setAttribute("visibility", swing.moon >= 70 ? "visible" : "hidden");
    document.querySelector("#swing-milestone").textContent = swing.moon === 100 ? "花瓣、星星和一整圈月光，都属于今晚。" : swing.moon >= 70 ? "星星挂上绳子了，再一起向月光靠近。" : swing.moon >= 28 ? "碰到花瓣啦，下一站是星星。" : "轻轻出发 → 花瓣 → 星星 → 月光";
  }

  function tick(now) {
    const oldMode = swing.mode;
    swing = SwingRules.step(swing, (now - previous) / 1000);
    previous = now;
    renderMotion(now);
    if (oldMode !== swing.mode) {
      status.textContent = `秋千慢慢停下来了。今晚我们一起荡到 ${swing.height} cm，星星留在绳子上。`;
      renderProgress();
      store.save(swing);
    }
    if (swing.mode === "stopped" || (!swing.started && now - lastPush >= 800)) {
      frame = 0;
      scene.classList.remove("is-running");
    } else frame = requestAnimationFrame(tick);
  }

  function syncAnimation() {
    cancelAnimationFrame(frame);
    frame = 0;
    const active = !view.hidden && !document.hidden;
    scene.classList.toggle("is-running", active && swing.mode !== "stopped");
    if (active) {
      previous = performance.now();
      renderMotion(previous);
      frame = requestAnimationFrame(tick);
    } else store.save(swing);
  }

  function push() {
    if (view.hidden || document.hidden) return;
    const player = players[swing.player];
    const now = performance.now();
    const result = SwingRules.push(swing, now, lastPush);
    if (result.outcome === "ignored") return;
    lastPush = now;
    swing = result.state;
    status.textContent = result.outcome === "good" ? `${player}推得刚刚好！我们荡高了一点，接下来换${players[swing.player]}。` : `${player}推得有点早或晚，秋千轻轻晃了一下。月光还在，换${players[swing.player]}试试。`;
    if (swing.moon === 100) status.textContent = "一整圈月光攒满啦！我们一起收好星星，让秋千慢慢停下来。";
    renderProgress(); renderMotion(now);
    store.save(swing);
    syncAnimation();
  }

  document.querySelector("#enter-swing").addEventListener("click", () => ParkNavigation.show("swing"));
  document.querySelector("#swing-back").addEventListener("click", () => ParkNavigation.show("park"));
  pushButton.addEventListener("click", push);
  gentleButton.addEventListener("click", () => {
    swing = SwingRules.toggleGentle(swing);
    status.textContent = swing.mode === "gentle" ? "先不赶路啦。我们并排坐着，慢慢摇，看月光和萤火虫。" : swing.moon === 100 ? "回到今晚的月光留念，星星和最高记录都留好了。" : "回来继续配合啦，等光点回到绿色中间，再推一把。";
    renderProgress(); store.save(swing); syncAnimation();
  });
  document.querySelector("#restart-swing").addEventListener("click", () => {
    if (!confirm("重新攒这一圈月光吗？我们的最高记录会保留。")) return;
    swing = { ...SwingRules.defaults(), best: swing.best };
    lastPush = -1000;
    status.textContent = "新一圈月光，月月先来。哥哥和你并排坐好了。";
    renderProgress(); store.save(swing); syncAnimation();
  });
  window.addEventListener("keydown", event => {
    if (view.hidden || event.repeat || event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement) return;
    if (event.code === "Space" || event.key === "Enter") { event.preventDefault(); push(); }
  });
  document.addEventListener("park-view-change", syncAnimation);
  document.addEventListener("visibilitychange", syncAnimation);
  window.addEventListener("pagehide", () => store.save(swing));
  reduced.addEventListener("change", syncAnimation);
  renderProgress(); renderMotion(performance.now());
  if (swing.moon) status.textContent = swing.moon === 100 ? "上次的一整圈月光还在，星星和最高记录都留好了。" : "上次攒到的月光还在，我们从这里接着荡。";
})();
