const fileInput = document.getElementById("fileInput");
const editor = document.getElementById("editor");
const image = document.getElementById("image");
const downloadPhoto = document.getElementById("downloadPhoto");
const downloadSheet = document.getElementById("downloadSheet");
const zoomIn = document.getElementById("zoomIn");
const zoomOut = document.getElementById("zoomOut");
const reset = document.getElementById("reset");

let cropper = null;

// 35 x 45 mm à 300 dpi = environ 413 x 531 pixels
const PHOTO_WIDTH = 413;
const PHOTO_HEIGHT = 531;

// 10 x 15 cm à 300 dpi = environ 1181 x 1772 pixels
const SHEET_WIDTH = 1181;
const SHEET_HEIGHT = 1772;

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  image.src = url;
  editor.classList.remove("hidden");

  image.onload = () => {
    if (cropper) cropper.destroy();

    cropper = new Cropper(image, {
      aspectRatio: 35 / 45,
      viewMode: 1,
      dragMode: "move",
      autoCropArea: 1,
      background: false,
      responsive: true,
      cropBoxMovable: false,
      cropBoxResizable: false
    });
  };
});

zoomIn.addEventListener("click", () => cropper?.zoom(0.1));
zoomOut.addEventListener("click", () => cropper?.zoom(-0.1));
reset.addEventListener("click", () => cropper?.reset());

downloadPhoto.addEventListener("click", () => {
  if (!cropper) return;

  const canvas = cropper.getCroppedCanvas({
    width: PHOTO_WIDTH,
    height: PHOTO_HEIGHT,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high"
  });

  downloadCanvas(canvas, "pixi3d-photo-35x45mm.jpg");
});

downloadSheet.addEventListener("click", () => {
  if (!cropper) return;

  const photoCanvas = cropper.getCroppedCanvas({
    width: PHOTO_WIDTH,
    height: PHOTO_HEIGHT,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high"
  });

  const sheet = document.createElement("canvas");
  sheet.width = SHEET_WIDTH;
  sheet.height = SHEET_HEIGHT;

  const ctx = sheet.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);

  // Planche 10 x 15 cm : 2 colonnes x 3 lignes = 6 photos identiques
  const marginX = 110;
  const marginY = 70;
  const gapX = 135;
  const gapY = 45;

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const x = marginX + col * (PHOTO_WIDTH + gapX);
      const y = marginY + row * (PHOTO_HEIGHT + gapY);

      ctx.drawImage(photoCanvas, x, y, PHOTO_WIDTH, PHOTO_HEIGHT);

      // Traits de découpe discrets
      ctx.strokeStyle = "#cccccc";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.strokeRect(x, y, PHOTO_WIDTH, PHOTO_HEIGHT);
      ctx.setLineDash([]);
    }
  }

  downloadCanvas(sheet, "pixi3d-planche-10x15cm.jpg");
});

function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }, "image/jpeg", 0.95);
}
