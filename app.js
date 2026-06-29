const fileInput = document.getElementById("fileInput");
const workspace = document.getElementById("workspace");
const image = document.getElementById("image");
const statusText = document.getElementById("statusText");
const photoTabs = document.getElementById("photoTabs");
const previewSheet = document.getElementById("previewSheet");
const downloadSheet = document.getElementById("downloadSheet");
const sheetPreview = document.getElementById("sheetPreview");
const deletePhoto = document.getElementById("deletePhoto");
const zoomIn = document.getElementById("zoomIn");
const zoomOut = document.getElementById("zoomOut");
const reset = document.getElementById("reset");

let cropper = null;
let photos = [];
let activeIndex = 0;

// 35 x 45 mm à 300 dpi = environ 413 x 531 pixels
const PHOTO_WIDTH = 413;
const PHOTO_HEIGHT = 531;

// 10 x 15 cm à 300 dpi = environ 1181 x 1772 pixels
const SHEET_WIDTH = 1181;
const SHEET_HEIGHT = 1772;

deletePhoto.classList.add("hidden");

fileInput.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []);

  if (files.length === 0) return;

  saveCurrentCrop();

  const freeSlots = 6 - photos.length;

  if (freeSlots <= 0) {
    alert("Vous avez déjà ajouté 6 photos maximum.");
    fileInput.value = "";
    return;
  }

  const filesToAdd = files.slice(0, freeSlots);

  const newPhotos = filesToAdd.map((file, index) => ({
    name: file.name,
    url: URL.createObjectURL(file),
    cropData: null,
    index: photos.length + index
  }));

  photos = photos.concat(newPhotos);
  activeIndex = photos.length - newPhotos.length;

  workspace.classList.remove("hidden");
  sheetPreview.classList.add("hidden");

  renderTabs();
  loadActivePhoto();
  updateStatus();

  fileInput.value = "";
});

function renderTabs() {
  photoTabs.innerHTML = "";

  photos.forEach((photo, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `Photo ${index + 1}`;
    button.className = index === activeIndex ? "active" : "";

    button.addEventListener("click", () => {
      saveCurrentCrop();
      activeIndex = index;
      renderTabs();
      loadActivePhoto();
    });

    photoTabs.appendChild(button);
  });

  deletePhoto.classList.toggle("hidden", photos.length === 0);
}

function loadActivePhoto() {
  const photo = photos[activeIndex];

  if (!photo) {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    image.removeAttribute("src");
    return;
  }

  image.src = photo.url;

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
      cropBoxResizable: false,
      ready() {
        if (photo.cropData) {
          cropper.setData(photo.cropData);
        }
      }
    });
  };
}

function saveCurrentCrop() {
  if (!cropper || !photos[activeIndex]) return;
  photos[activeIndex].cropData = cropper.getData(true);
}

function updateStatus() {
  const count = photos.length;

  if (count === 0) {
    statusText.textContent = "";
    return;
  }

  const copies = getCopyCount(count);
  const total = count * copies;

  statusText.textContent =
    `${count} photo${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""} · ` +
    `${copies} copie${copies > 1 ? "s" : ""} par photo · ${total} emplacement${total > 1 ? "s" : ""} utilisé${total > 1 ? "s" : ""}`;
}

function getCopyCount(count) {
  if (count === 1) return 6;
  if (count === 2) return 3;
  if (count === 3) return 2;
  return 1;
}

deletePhoto.addEventListener("click", () => {
  if (photos.length === 0) return;

  const ok = confirm("Supprimer cette photo de la planche ?");
  if (!ok) return;

  const removedPhoto = photos.splice(activeIndex, 1)[0];

  if (removedPhoto && removedPhoto.url) {
    URL.revokeObjectURL(removedPhoto.url);
  }

  photos.forEach((photo, index) => {
    photo.index = index;
  });

  if (photos.length === 0) {
    activeIndex = 0;

    if (cropper) {
      cropper.destroy();
      cropper = null;
    }

    image.removeAttribute("src");
    workspace.classList.add("hidden");
    sheetPreview.classList.add("hidden");
    renderTabs();
    updateStatus();
    return;
  }

  if (activeIndex >= photos.length) {
    activeIndex = photos.length - 1;
  }

  sheetPreview.classList.add("hidden");
  renderTabs();
  updateStatus();
  loadActivePhoto();
});

zoomIn.addEventListener("click", () => cropper?.zoom(0.1));
zoomOut.addEventListener("click", () => cropper?.zoom(-0.1));

reset.addEventListener("click", () => {
  if (!cropper || !photos[activeIndex]) return;

  photos[activeIndex].cropData = null;
  cropper.reset();
  sheetPreview.classList.add("hidden");
});

previewSheet.addEventListener("click", async () => {
  const sheet = await generateSheet();
  if (!sheet) return;

  const previewCtx = sheetPreview.getContext("2d");
  sheetPreview.width = SHEET_WIDTH;
  sheetPreview.height = SHEET_HEIGHT;
  previewCtx.clearRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);
  previewCtx.drawImage(sheet, 0, 0);

  sheetPreview.classList.remove("hidden");
});

downloadSheet.addEventListener("click", async () => {
  const sheet = await generateSheet();
  if (!sheet) return;

  downloadCanvas(sheet, "pixi3d-planche-10x15cm.jpg");
});

async function generateSheet() {
  if (!cropper || photos.length === 0) return null;

  saveCurrentCrop();

  const croppedPhotos = [];

  for (let i = 0; i < photos.length; i++) {
    const photoCanvas = await cropPhoto(i);
    croppedPhotos.push(photoCanvas);
  }

  const sheet = document.createElement("canvas");
  sheet.width = SHEET_WIDTH;
  sheet.height = SHEET_HEIGHT;

  const ctx = sheet.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);

  const slots = buildSlots(croppedPhotos);
  drawSlots(ctx, slots);

  return sheet;
}

function cropPhoto(index) {
  return new Promise((resolve) => {
    const tempImage = new Image();

    tempImage.onload = () => {
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "fixed";
      tempContainer.style.left = "-99999px";
      tempContainer.style.top = "-99999px";
      tempContainer.appendChild(tempImage);
      document.body.appendChild(tempContainer);

      const tempCropper = new Cropper(tempImage, {
        aspectRatio: 35 / 45,
        viewMode: 1,
        autoCropArea: 1,
        background: false,
        ready() {
          if (photos[index].cropData) {
            tempCropper.setData(photos[index].cropData);
          }

          const canvas = tempCropper.getCroppedCanvas({
            width: PHOTO_WIDTH,
            height: PHOTO_HEIGHT,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: "high"
          });

          tempCropper.destroy();
          document.body.removeChild(tempContainer);
          resolve(canvas);
        }
      });
    };

    tempImage.src = photos[index].url;
  });
}

function buildSlots(croppedPhotos) {
  const copies = getCopyCount(croppedPhotos.length);
  const slots = [];

  croppedPhotos.forEach((canvas) => {
    for (let i = 0; i < copies; i++) {
      slots.push(canvas);
    }
  });

  return slots.slice(0, 6);
}

function drawSlots(ctx, slots) {
  // Grille 2 colonnes x 3 lignes
  const marginX = 110;
  const marginY = 70;
  const gapX = 135;
  const gapY = 45;

  slots.forEach((canvas, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;

    const x = marginX + col * (PHOTO_WIDTH + gapX);
    const y = marginY + row * (PHOTO_HEIGHT + gapY);

    ctx.drawImage(canvas, x, y, PHOTO_WIDTH, PHOTO_HEIGHT);

    // Traits de découpe discrets
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(x, y, PHOTO_WIDTH, PHOTO_HEIGHT);
    ctx.setLineDash([]);
  });
}

function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }, "image/jpeg", 0.95);
}
