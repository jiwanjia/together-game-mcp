window.ClawStorage = function (showWarning) {
  const preview = new URLSearchParams(location.search).has("preview");
  const key = preview ? "playtogether-claw-preview" : "playtogether-claw-v2";
  const defaults = () => ({ version: 2, player: 0, x: 50, caught: [], positions: [14, 32, 50, 68, 86] });
  const storage = () => preview ? sessionStorage : localStorage;
  let readable = true;

  function load() {
    try {
      const raw = JSON.parse(storage().getItem(key));
      if (!raw) return defaults();
      if (raw.version !== 2 || !Array.isArray(raw.positions) || raw.positions.length !== 5 ||
          !raw.positions.every(value => Number.isFinite(value) && value >= 10 && value <= 90) ||
          !Array.isArray(raw.caught) || ![0, 1].includes(raw.player) || !Number.isFinite(raw.x)) {
        readable = false;
        showWarning("旧存档暂时无法读取；原记录仍保留，这次先在页面里玩。");
        return defaults();
      }
      return {
        version: 2, player: raw.player, x: ClawRules.clamp(raw.x, 10, 90), positions: raw.positions,
        caught: [...new Set(raw.caught.filter(name => ClawRules.toys.some(toy => toy.name === name)))],
      };
    } catch {
      readable = false;
      showWarning("浏览器暂时不能读取存档，这次收藏只保留在当前页面。");
      return defaults();
    }
  }

  function save(state) {
    if (!readable) return;
    try { storage().setItem(key, JSON.stringify(state)); }
    catch { showWarning("浏览器暂时不能保存，刷新可能丢失本次进度。"); }
  }
  return { load, save, defaults };
};
