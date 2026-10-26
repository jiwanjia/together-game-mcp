(function (root) {
  "use strict";
  const identities = ["yueyue", "yan", "yu"];
  const source = "assets/IMAGES/exec-fe8bc33a-4c53-4c95-8900-2c4eea6fa871.png";
  const width = 288, sourceWidth = 373, sourceHeight = 301;
  const anchors = { yueyue: { x: 780, y: 635 }, yan: { x: 879, y: 675 }, yu: { x: 994, y: 701 } };

  function layout(actors) {
    const seated = identities.map(id => actors[id]);
    if (seated.some(actor => !actor || actor.posture !== "sitting" ||
        !Number.isInteger(actor.seat) || actor.seat < 0 || actor.seat > 2)) return null;
    if (new Set(seated.map(actor => actor.seat)).size !== 3) return null;
    const x = (Math.min(...seated.map(actor => actor.screen.x)) +
      Math.max(...seated.map(actor => actor.screen.x))) / 2 + 22;
    const y = Math.max(...seated.map(actor => actor.screen.y)) - 18;
    const height = width * sourceHeight / sourceWidth;
    const positions = Object.fromEntries(identities.map(id => [id, {
      x: x - width / 2 + (anchors[id].x - 694) * width / sourceWidth,
      y: y - height * .97 + (anchors[id].y - 413) * width / sourceWidth
    }]));
    return { x, y, width, positions, depth: Math.round(y) };
  }

  function createImage(floor) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "room-seated-trio";
    svg.classList.add("room-seated-trio");
    svg.setAttribute("viewBox", "694 413 373 301");
    svg.setAttribute("aria-hidden", "true");
    // Reuse the original-pixel couple; mask Yu from that exact same reference.
    svg.innerHTML = `<defs><clipPath id="room-trio-yu-mask"><path d="
      M956 475 C947 467 958 463 969 470 C975 461 992 459 997 473
      C1013 472 1026 482 1031 493 L1041 495 1038 505 1048 512 1044 521
      1054 528 1047 539 1053 548 1044 558 1041 569 1026 577 1021 589
      1021 615 1008 635 1005 650 997 660 989 657 966 686
      C967 698 951 708 937 703 L923 696 C910 704 895 697 889 686
      L878 681 880 669 897 649 912 625 927 611 930 601 917 603
      911 597 916 589 928 590 938 581 942 570 935 562 937 549 930 540
      939 532 933 523 940 514 936 505 945 499 941 487 952 487 Z"/></clipPath></defs>
      <image x="0" y="0" width="1254" height="1254" href="${source}" clip-path="url(#room-trio-yu-mask)"/>
      <image x="694" y="413" width="242" height="264" href="${document.querySelector("#room-seated-pair").getAttribute("src")}"/>`;
    floor.append(svg);
    return svg;
  }

  function render(actors) {
    const floor = document.querySelector("#room-floor");
    if (!floor) return;
    let image = document.querySelector("#room-seated-trio");
    const trio = layout(actors);
    for (const id of identities) {
      const element = document.querySelector(`#room-${id}`);
      if (element) element.dataset.trio = String(Boolean(trio));
    }
    if (!trio) {
      if (image) image.style.display = "none";
      return;
    }
    if (!image) image = createImage(floor);
    image.style.display = "block";
    image.style.left = `${trio.x / 10}%`;
    image.style.top = `${trio.y / 10}%`;
    image.style.width = `${trio.width / 10}%`;
    image.style.zIndex = trio.depth;
    document.querySelector("#room-seated-pair").hidden = true;
    for (const id of identities) {
      const element = document.querySelector(`#room-${id}`);
      element.style.left = `${trio.positions[id].x / 10}%`;
      element.style.top = `${trio.positions[id].y / 10}%`;
    }
  }

  const api = { layout, render };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SofaSeatedTrio = api;
})(typeof window === "undefined" ? globalThis : window);
