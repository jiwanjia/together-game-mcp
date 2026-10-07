window.ParkNavigation = (function () {
  const views = { welcome: document.querySelector("#welcome-view"), park: document.querySelector("#park-view"),
    home: document.querySelector("#living-room-view"),
    "claw-machine": document.querySelector("#claw-view"), swing: document.querySelector("#swing-view") };
  const focus = { welcome: "#enter-home", home: "#room-floor", park: "#enter-claw-machine", "claw-machine": "#aim-position", swing: "#push-swing" };
  function show(name, moveFocus = true) {
    const selected = Object.hasOwn(views, name) ? name : "welcome";
    Object.entries(views).forEach(([key, view]) => { view.hidden = key !== selected; });
    if (location.hash !== `#${selected}`) history.pushState(null, "", `#${selected}`);
    document.dispatchEvent(new CustomEvent("park-view-change", { detail: selected }));
    if (moveFocus) document.querySelector(focus[selected]).focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", () => show(location.hash.slice(1)));
  document.addEventListener("DOMContentLoaded", () => show(location.hash.slice(1) || "welcome", false));
  return { show };
})();
