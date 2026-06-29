document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
  const workspace = document.getElementById("workspace");
  const image = document.getElementById("image");
  const statusText = document.getElementById("statusText");
  const photoTabs = document.getElementById("photoTabs");
  const downloadSheet = document.getElementById("downloadSheet");
  const zoomIn = document.getElementById("zoomIn");
  const zoomOut = document.getElementById("zoomOut");
  const reset = document.getElementById("reset");

  let cropper = null;
  let photos = [];
  let activeIndex = 0;

  const PHOTO_WIDTH = 413;
  const PHOTO_HEIGHT = 531;
  const SHEET_WIDTH = 1181;
  const SHEET_HEIGHT = 1772;

  fileInput.addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []).slice(0, 6);

    if (files.length === 0) {
      return;
    }

    photos.forEach((photo) => URL.revokeObjectURL(photo.url));

    photos = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      cropData: null
    }));

    activeIndex = 0;
    workspace.classList.remove("hidden");

    renderTabs();
    updateStatus();
    loadPhoto(activeIndex);
  });

  function renderTabs() {
    photoTabs.innerHTML = "";

    photos.forEach((photo, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `Photo ${index + 1}`;

      if (index === activeIndex) {
        button.classList.add("active");
      }

      button.addEventListener("click", () => {
        saveCropData();
        activeIndex = index;
        renderTabs();
        loadPhoto(activeIndex);
      });

      photoTabs.appendChild(button);
    });
  }

  function updateStatus() {
    const count = photos.length;
    const copies = getCopiesPerPhoto(count);
    const total = count * copies;

    statusText.textContent =
      `${count} photo${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""} · ` +
      `${copies} copie${copies > 1 ? "s" : ""} par photo · ` +
      `${total} photo${total > 1 ? "s" : ""} sur la planche`;
  }

  function loadPhoto(index) {
    const photo = photos[index];

    if (!photo) {
      return;
    }

    image.src = photo.url;

    image.onload = () => {
      if (cropper) {
        cropper.destroy();
      }

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

  function saveCropData() {
    if (!cropper || !photos[activeIndex]) {
      return;
    }

    photos[activeIndex].cropData = cropper.getData(true);
  }

  function getCopiesPerPhoto(count) {
    if (count === 1) return 6;
    if (count === 2) return 3;
    if (count === 3) return 2;
    return 1;
  }

  zoomIn.addEventListener("click", () => {
    if (cropper) cropper.zoom(0.1);
  });

  zoomOut.addEventListener("click", () => {
    if (cropper) cropper.zoom(-0.1);
  });

  reset.addEventListener("click", () => {
    if (cropper) cropper.reset();
  });

  downloadSheet.addEventListener("click", async () => {
    if (!cropper || photos.length === 0) {
      alert("Ajoutez au moins une photo.");
      return;
    }

    saveCropData();

    const croppedCanvases = [];

    for (const photo of photos) {
      const canvas = await cropImageFromPhoto(photo);
      croppedCanvases.push(canvas);
    }

    const sheet = buildSheet(croppedCanvases);
    downloadCanvas(sheet, "pixi3d-planche-10x15cm.jpg");
  });

  function cropImageFromPhoto(photo) {
    return new Promise((resolve) => {
      const tempImage = new Image();

      tempImage.onload = () => {
        const container = document.createElement("div");
        container.style.position = "fixed";
        container.style.left = "-10000px";
        container.style.top = "-10000px";
        container.style.width = "400px";
        container.style.height = "500px";
        container.style.opacity = "0";

        tempImage.style.maxWidth = "400px";
        container.appendChild(tempImage);
        document.body.appendChild(container);

        const tempCropper = new Cropper(tempImage, {
          aspectRatio: 35 / 45,
          viewMode: 1,
          autoCropArea: 1,
          background: false,
          ready() {
            if (photo.cropData) {
              tempCropper.setData(photo.cropData);
            }

            const canvas = tempCropper.getCroppedCanvas({
              width: PHOTO_WIDTH,
              height: PHOTO_HEIGHT,
              imageSmoothingEnabled: true,
              imageSmoothingQuality: "high"
            });

            tempCropper.destroy();
            document.body.removeChild(container);
            resolve(canvas);
          }
        });
      };

      tempImage.src = photo.url;
    });
  }

  function buildSheet(croppedCanvases) {
    const sheet = document.createElement("canvas");
    sheet.width = SHEET_WIDTH;
    sheet.height = SHEET_HEIGHT;

    const ctx = sheet.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);

    const copiesPerPhoto = getCopiesPerPhoto(croppedCanvases.length);
    const slots = [];

    croppedCanvases.forEach((canvas) => {
      for (let i = 0; i < copiesPerPhoto; i++) {
        slots.push(canvas);
      }
    });

    const marginX = 110;
    const marginY = 70;
    const gapX = 135;
    const gapY = 45;

    slots.slice(0, 6).forEach((canvas, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;

      const x = marginX + col * (PHOTO_WIDTH + gapX);
      const y = marginY + row * (PHOTO_HEIGHT + gapY);

      ctx.drawImage(canvas, x, y, PHOTO_WIDTH, PHOTO_HEIGHT);

      ctx.strokeStyle = "#cccccc";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.strokeRect(x, y, PHOTO_WIDTH, PHOTO_HEIGHT);
      ctx.setLineDash([]);
    });

    return sheet;
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
});
