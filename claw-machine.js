const parkView = document.querySelector("#park-view");
const clawView = document.querySelector("#claw-view");
const claw = document.querySelector("#claw");
const leftButton = document.querySelector("#move-left");
const rightButton = document.querySelector("#move-right");
const dropButton = document.querySelector("#drop-claw");
const resetButton = document.querySelector("#reset-game");
const slider = document.querySelector("#aim-position");
const statusLabel = document.querySelector("#game-status");
const playerLabel = document.querySelector("#current-player");
const aimLabel = document.querySelector("#aim-status");
const guide = document.querySelector("#aim-guide");
const storage = ClawStorage(text => { document.querySelector("#save-status").textContent = text; });
let state = storage.load();
let busy = false;
let heldDirection = 0;
let holdFrame = 0;
let suppressClick = false;
const players = ["月月", "砚"];
const prizes = [...document.querySelectorAll(".prize")];
const animation = ClawAnimation(claw, document.querySelector(".machine-window"), () => clawView.hidden || document.hidden);

function renderCollection() {
  const collection = document.querySelector("#collection");
  collection.replaceChildren();
  state.caught.forEach(name => {
    const toy = ClawRules.toys.find(item => item.name === name);
    const card = document.createElement("div");
    card.className = "collection-prize";
    const image = document.createElement("span");
    image.textContent = toy.emoji;
    image.setAttribute("aria-hidden", "true");
    const label = document.createElement("small");
    label.textContent = name;
    card.append(image, label);
    collection.append(card);
  });
  if (!state.caught.length) {
    const empty = document.createElement("p");
    empty.className = "empty-collection";
    empty.textContent = "留一层小柜子，等我们带它们回家。";
    collection.append(empty);
  }
  document.querySelector("#prize-count").textContent = String(state.caught.length);
}

function renderPrizes() {
  prizes.forEach((prize, index) => {
    prize.classList.toggle("is-caught", state.caught.includes(ClawRules.toys[index].name));
    prize.style.left = `${state.positions[index]}%`;
    prize.style.opacity = "";
    prize.style.setProperty("--lift", "0px");
    prize.style.setProperty("--tilt", "0deg");
  });
}

function renderAim() {
  slider.value = String(state.x);
  animation.pose(state.x, 64);
  guide.style.left = `${state.x}%`;
  const target = ClawRules.targetAt(state.x, state.positions, state.caught);
  let text = "这里是空的，轻轻挪到娃娃上方吧。";
  let aligned = false;
  if (target && target.distance < target.toy.width) {
    aligned = target.distance < target.toy.width * 0.2;
    const precision = aligned ? "正中 · 很稳" : target.distance < target.toy.width * 0.5 ? "有点偏 · 会晃" : "爪尖 · 容易滑";
    text = `${target.toy.name} · ${precision} · ${target.toy.hint}`;
  }
  if (state.caught.length === 5) text = "五只都回家啦！想再玩，可以重新摆好。";
  aimLabel.textContent = text;
  guide.classList.toggle("is-aligned", aligned);
  leftButton.disabled = busy || state.x <= 10;
  rightButton.disabled = busy || state.x >= 90;
  dropButton.disabled = busy || state.caught.length === 5;
  slider.disabled = busy || state.caught.length === 5;
  resetButton.disabled = busy;
  playerLabel.textContent = players[state.player];
}

function moveTo(x) {
  if (busy || clawView.hidden) return;
  state.x = ClawRules.clamp(x, 10, 90);
  renderAim();
  storage.save(state);
}

function stopHolding() {
  heldDirection = 0;
  cancelAnimationFrame(holdFrame);
}

function startHolding(direction) {
  if (busy) return;
  stopHolding();
  heldDirection = direction;
  const started = performance.now();
  let previous = started;
  function tick(now) {
    if (!heldDirection || busy) return;
    if (now - started > 180) {
      suppressClick = true;
      moveTo(state.x + heldDirection * Math.min(now - previous, 40) * 0.018);
    }
    previous = now;
    holdFrame = requestAnimationFrame(tick);
  }
  holdFrame = requestAnimationFrame(tick);
}

async function dropClaw() {
  if (busy || state.caught.length === 5) return;
  stopHolding();
  busy = true;
  const player = players[state.player];
  const startX = state.x;
  const result = ClawRules.planGrab(startX, state.positions, state.caught);
  result.positions = [...state.positions];
  result.caught = [...state.caught];
  renderAim();
  guide.hidden = true;
  const prize = result.target ? prizes[result.target.index] : null;
  try {
    const landing = await animation.play(startX, result, prize, text => { statusLabel.textContent = `${player}：${text}`; });
    if (result.kind === "catch") {
      state.caught.push(result.target.toy.name);
      statusLabel.textContent = `${player}把${result.target.toy.name}送到出口了！${state.caught.length === 5 ? "五只都住进我们的小柜子啦。" : "收好，换另一个人来。"}`;
    } else if (result.kind === "slip") {
      state.positions[result.target.index] = landing;
      statusLabel.textContent = `${player}夹起了${result.target.toy.name}，但半路滑落了。它换了个位置，下一轮接着抓！`;
    } else {
      statusLabel.textContent = `${player}空爪了，没关系。看准下面的小家伙，换个人再试。`;
    }
    state.player = (state.player + 1) % 2;
    state.x = 86;
    storage.save(state);
  } catch (error) {
    console.error("抓取动画未完成", error);
    statusLabel.textContent = "这次爪子卡住了，收藏没有改变；可以再试一次。";
  } finally {
    busy = false;
    guide.hidden = false;
    claw.classList.remove("is-closed");
    renderPrizes();
    renderCollection();
    renderAim();
  }
}

function showView(entering) {
  stopHolding();
  parkView.hidden = entering;
  clawView.hidden = !entering;
  location.hash = entering ? "claw-machine" : "park";
  (entering ? slider : document.querySelector("#enter-claw-machine")).focus();
}

document.querySelector("#enter-claw-machine").addEventListener("click", () => showView(true));
document.querySelector("#back-to-park").addEventListener("click", () => showView(false));
document.querySelector(".brand").addEventListener("click", event => { event.preventDefault(); showView(false); });
slider.addEventListener("input", () => moveTo(Number(slider.value)));
dropButton.addEventListener("click", dropClaw);
resetButton.addEventListener("click", () => {
  if (busy || !window.confirm("要把收藏柜里的娃娃重新放回箱子吗？")) return;
  state = storage.defaults();
  storage.save(state);
  renderPrizes(); renderCollection(); renderAim();
  statusLabel.textContent = "重新摆好了！月月先来，轻轻对准再下爪。";
});
[leftButton, rightButton].forEach((button, index) => {
  const direction = index === 0 ? -1 : 1;
  button.addEventListener("pointerdown", event => {
    suppressClick = false;
    button.setPointerCapture(event.pointerId);
    startHolding(direction);
  });
  button.addEventListener("click", () => {
    if (!suppressClick) moveTo(state.x + direction * 2);
    suppressClick = false;
  });
  button.addEventListener("pointerup", stopHolding);
  button.addEventListener("pointercancel", stopHolding);
  button.addEventListener("lostpointercapture", stopHolding);
});
window.addEventListener("blur", stopHolding);
document.addEventListener("visibilitychange", stopHolding);
window.addEventListener("keydown", event => {
  if (clawView.hidden || event.target === slider || event.target instanceof HTMLButtonElement) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    moveTo(state.x + (event.key === "ArrowLeft" ? -2 : 2));
  } else if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    dropClaw();
  }
});

renderPrizes(); renderCollection(); renderAim();
statusLabel.textContent = state.caught.length ? "刚才抓到的小家伙都留好了。对准下一只，我们接着玩。" : "月月先来。轻推左右按钮或拖动滑杆，对准娃娃，再下爪。";
if (location.hash === "#claw-machine") showView(true);
