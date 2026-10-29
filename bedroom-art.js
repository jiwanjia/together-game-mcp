(function () {
  "use strict";
  class BedroomArt {
    constructor(floor) {
      floor.insertAdjacentHTML("beforeend", `<svg class="bedroom-trio" viewBox="0 0 1254 1254" aria-hidden="true" hidden>
        <defs><clipPath id="bedroom-bedding-outline"><path d="M50 145 Q45 125 80 130 L440 40 Q485 0 535 35 L560 90 L980 65 Q1000 8 1050 30 L1440 135 Q1500 145 1490 195 L1470 465 Q1520 480 1500 530 L1508 700 Q1540 740 1490 810 L1475 920 Q1460 1005 1370 980 L1120 960 Q1080 1005 1020 960 L870 935 Q800 990 715 960 L470 945 Q420 990 350 945 L100 940 Q15 930 40 860 L25 790 Q5 755 40 720 L25 650 Q10 610 40 580 L40 505 Q25 470 55 445 Z"/></clipPath>
        <clipPath id="bedroom-pair-outline" clipPathUnits="objectBoundingBox"><polygon points="0,0 1,0 1,1 .45,1 .27,.68 .18,.55 .18,.45 0,.45"/></clipPath>
        <clipPath id="bedroom-quilt-mask"><path d="M201 715 L301 652 L426 589 L502 539 L589 577 L665 665 L702 727 L702 852 L464 928 L188 828 Z"/></clipPath></defs>
        <image href="assets/bedroom/rose-corner-window-room-v1.png" width="1254" height="1254"/>
        <g id="bedroom-trio-transform" transform="translate(138 552) rotate(-30) scale(.23)"><image href="assets/bedroom/yueyue-yan-yu-bed-preview.png" width="1536" height="1024" clip-path="url(#bedroom-bedding-outline)"/></g>
        <image id="bedroom-pair-image" x="131.67" y="432.63" width="338.58" height="282.15" transform="rotate(-30 300.96 531.38)" clip-path="url(#bedroom-pair-outline)"/>
        <image href="assets/bedroom/rose-corner-window-room-v1.png" width="1254" height="1254" clip-path="url(#bedroom-quilt-mask)"/>
      </svg>`);
      this.layer = floor.querySelector(".bedroom-trio");
      this.trio = floor.querySelector("#bedroom-trio-transform");
      this.pair = floor.querySelector("#bedroom-pair-image");
    }
    render(state) {
      const trio = state.rest.participants.length === 3;
      this.layer.toggleAttribute("hidden", !state.resting);
      this.layer.dataset.mode = trio ? "trio" : "pair";
      this.trio.toggleAttribute("hidden", !trio);
      this.pair.toggleAttribute("hidden", trio || !state.resting);
      if (!trio && state.resting) {
        const companion = state.rest.participants.find(id => id !== "yueyue");
        this.pair.setAttribute("href", companion === "yan" ? "assets/bedroom/yueyue-yan-cuddle-preview.png" : "assets/bedroom/yueyue-yu-cuddle-v1.png");
      }
    }
  }
  window.BedroomArt = BedroomArt;
})();
