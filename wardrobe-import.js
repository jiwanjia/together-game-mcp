(function () {
  "use strict";
  const maxBytes = 4 * 1024 * 1024;
  async function inspect(file) {
    if (!file || !file.size || file.size > maxBytes) throw new Error("Choose a PNG up to 4 MB.");
    const header = new Uint8Array(await file.slice(0, 24).arrayBuffer());
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (!signature.every((value, index) => header[index] === value) || header.length < 24) {
      throw new Error("Choose a valid PNG image.");
    }
    const dimensions = new DataView(header.buffer);
    const width = dimensions.getUint32(16), height = dimensions.getUint32(20);
    if (!width || !height || width > 4096 || height > 4096) throw new Error("Use a PNG no larger than 4096 × 4096 pixels.");
    const src = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, width, height).data;
      let left = width, top = height, right = -1, bottom = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (pixels[(y * width + x) * 4 + 3] < 16) continue;
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
      if (right < left) throw new Error("This PNG is empty. Choose a visible character.");
      return { src, data: file, width, height, cellWidth: width, cellHeight: height,
        body: { x: left, y: top, width: right - left + 1, height: bottom - top + 1 } };
    } catch (error) {
      URL.revokeObjectURL(src);
      if (error.name === "EncodingError") throw new Error("This PNG could not be opened. Try another image.");
      throw error;
    }
  }
  window.WardrobeImport = Object.freeze({ inspect });
})();
