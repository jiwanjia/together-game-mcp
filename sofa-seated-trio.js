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
    // All three people share one source and one scale, including their joined hands.
    // The silhouette only hides the reference room; it never redraws the people.
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.innerHTML = `<defs><clipPath id="room-trio-mask"><path d="
      M740 449 C751 433 771 429 788 435 C803 437 814 447 820 461
      L820 447 827 439 821 434 834 435 831 427 842 429
      843 419 851 425 859 416 866 423 875 416 878 423
      C894 419 906 426 913 438 L925 439 919 446 929 452 922 457
      931 468 925 473 931 482 925 488 928 497 920 500
      C923 509 914 517 911 522 C922 535 927 553 929 575
      L936 591 933 606 925 616 915 611 911 596
      C902 618 886 635 879 649 C878 660 868 674 855 677
      C844 679 832 674 825 668 C810 673 793 665 786 656
      C779 648 785 638 794 631 L818 596 827 581 817 575
      L805 591 795 605 C792 618 785 630 774 635
      C764 639 751 635 745 628 C734 633 721 628 716 621
      C711 613 718 601 726 594 L733 577
      C724 583 714 577 716 571 C704 575 699 568 707 561
      C695 560 695 552 704 548 C694 546 698 538 706 535
      C701 530 705 521 712 516 L717 499 723 485 726 469
      C727 457 732 452 740 449 Z
      M956 475 C947 467 958 463 969 470 C975 461 992 459 997 473
      C1013 472 1026 482 1031 493 L1041 495 1038 505 1048 512 1044 521
      1054 528 1047 539 1053 548 1044 558 1041 569 1026 577 1021 589
      1021 615 1008 635 1005 650 997 660 989 657 966 686
      C967 698 951 708 937 703 L923 696 C910 704 895 697 889 686
      L878 681 880 669 897 649 912 625 927 611 930 601 917 603
      911 597 916 589 928 590 938 581 942 570 935 562 937 549 930 540
      939 532 933 523 940 514 936 505 945 499 941 487 952 487 Z"/></clipPath></defs>
      <image x="0" y="0" width="1254" height="1254" preserveAspectRatio="xMidYMid meet"
        href="${source}" clip-path="url(#room-trio-mask)"/>`;
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
