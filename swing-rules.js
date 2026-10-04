/* Swing rhythm and progress have no dependency on rendering or storage. */
(function (root) {
  const circle = Math.PI * 2;
  const defaults = () => ({ version: 1, phase: 0, amplitude: .12, moon: 0,
    player: 0, started: false, mode: "play", best: 0, height: 0 });
  const heightAt = amplitude => Math.round((1 - Math.cos(amplitude)) * 300);
  const ready = state => state.mode === "play" && (!state.started || Math.abs(Math.sin(state.phase)) < .34);

  function push(state, now, lastPush) {
    if (state.mode !== "play" || now - lastPush < 800 || state.moon >= 100) return { state, outcome: "ignored" };
    const good = ready(state);
    const amplitude = good ? Math.min(.95, state.amplitude + .1) : Math.max(.12, state.amplitude * .95);
    const moon = good ? Math.min(100, state.moon + 14) : state.moon;
    const height = Math.max(state.height, heightAt(amplitude));
    return {
      outcome: good ? "good" : "early",
      state: { ...state, started: true, amplitude, moon, height,
        player: (state.player + 1) % 2, best: Math.max(state.best, height),
        mode: moon === 100 ? "settling" : "play" },
    };
  }

  function step(state, seconds) {
    if (!state.started || state.mode === "stopped") return state;
    const dt = Math.max(0, Math.min(.05, seconds));
    const phase = (state.phase + dt * 1.55) % circle;
    if (state.mode !== "settling") return { ...state, phase };
    const amplitude = state.amplitude * Math.exp(-1.8 * dt);
    if (amplitude < .012) return { ...state, phase: 0, amplitude: 0, started: false, mode: "stopped" };
    return { ...state, phase, amplitude };
  }

  function toggleGentle(state) {
    if (state.mode === "settling") return state;
    if (state.mode === "gentle") return { ...state, mode: state.moon === 100 ? "stopped" : "play", started: state.moon < 100 };
    return { ...state, mode: "gentle", started: true };
  }

  const api = { defaults, heightAt, ready, push, step, toggleGentle };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SwingRules = api;
})(globalThis);
