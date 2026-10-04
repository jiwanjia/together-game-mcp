window.SwingStorage = function (warning) {
  const preview = new URLSearchParams(location.search).has("preview");
  const key = preview ? "playtogether-swing-preview" : "playtogether-swing-v1";
  const storage = () => preview ? sessionStorage : localStorage;
  let readable = true;

  function load() {
    try {
      const raw = JSON.parse(storage().getItem(key));
      if (!raw) return SwingRules.defaults();
      const numeric = [raw.phase, raw.amplitude, raw.moon, raw.best, raw.height];
      if (raw.version !== 1 || !numeric.every(Number.isFinite) ||
          raw.phase < 0 || raw.phase > Math.PI * 2 || raw.amplitude < 0 || raw.amplitude > .95 ||
          raw.moon < 0 || raw.moon > 100 || ![0, 1].includes(raw.player) ||
          typeof raw.started !== "boolean" || raw.height < 0 || raw.height > 300 || raw.best < raw.height || raw.best > 300 ||
          !["play", "gentle", "settling", "stopped"].includes(raw.mode) ||
          (raw.moon === 100 && raw.mode === "play") || (raw.moon < 100 && ["settling", "stopped"].includes(raw.mode))) {
        readable = false;
        warning("旧秋千记录暂时读不了，原记录保留；这次先在页面里荡。");
        return SwingRules.defaults();
      }
      return { ...SwingRules.defaults(), ...raw };
    } catch {
      readable = false;
      warning("浏览器暂时不能读取秋千记录，这次只留在页面里。");
      return SwingRules.defaults();
    }
  }
  function save(state) {
    if (!readable) return;
    try { storage().setItem(key, JSON.stringify(state)); }
    catch { warning("浏览器暂时不能保存，刷新可能丢失本轮月光。"); }
  }
  return { load, save };
};
