import { auth, db } from "./firebase/firebase-config.js";
import { setupFilters, getActiveFilterObj } from "./filter/filter.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- DOM Elements ---
const studioBody = document.getElementById("studio-body");
const userGreeting = document.getElementById("user-greeting");
const logoutBtn = document.getElementById("logout-btn");
const toggleGalleryBtn = document.getElementById("toggle-gallery-btn");
const closeGalleryBtn = document.getElementById("close-gallery-btn");
const galleryModal = document.getElementById("gallery-modal");
const galleryGrid = document.getElementById("gallery-grid");

const cameraBox = document.getElementById("camera-box");
const video = document.getElementById("webcam");
const filterOverlayPreview = document.getElementById("filter-overlay-preview");
const countdownDisplay = document.getElementById("countdown-display");
const shotStatus = document.getElementById("shot-status");
const cameraFilterSelect = document.getElementById("camera-filter");
const stripThemeSelect = document.getElementById("strip-theme");
const stripCaptionInput = document.getElementById("strip-caption");
const startCaptureBtn = document.getElementById("start-capture-btn");
const retakeBtn = document.getElementById("retake-btn");
const uploadPhotoInput = document.getElementById("upload-photo-input");

const stripCanvas = document.getElementById("photo-strip-canvas");
const ctx = stripCanvas.getContext("2d");
const saveCloudBtn = document.getElementById("save-cloud-btn");
const downloadBtn = document.getElementById("download-btn");

const activeGlowPreview = document.getElementById("active-glow-preview");
const customGlowPicker = document.getElementById("custom-glow-picker");
const glowSlider = document.getElementById("glow-intensity");
const glowPercent = document.getElementById("glow-percent");

// --- Studio State ---
let currentUser = null;
let capturedPhotos = [];
let timerSeconds = 3;
let currentRatio = "4/3";
let currentLayout = "3-strip";
let glowColor = "none";
let glowOpacity = 1;
let hasCamera = false;

const RATIO_DIMENSIONS = {
  "4/3":  { w: 480, h: 360 },
  "16/9": { w: 512, h: 288 },
  "1/1":  { w: 400, h: 400 },
  "3/4":  { w: 360, h: 480 }
};

const LAYOUT_SHOTS = {
  "2-strip": 2,
  "3-strip": 3,
  "4-strip": 4,
  "4-grid":  4
};

function getRequiredShots() {
  return LAYOUT_SHOTS[currentLayout] || 3;
}

// --- 1. Auth Guard ---
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    currentUser = user;
    if (userGreeting) {
      userGreeting.textContent = `Hi, ${user.displayName || "Snapper"}!`;
    }
    loadCloudGallery();
  }
});

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

// --- 2. Tabs, Timer, Ratio, Grid & Glow Controls ---
document.querySelectorAll(".tool-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tool-tab").forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".tool-panel").forEach((p) => (p.hidden = true));

    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    const targetPanel = document.getElementById(tab.dataset.panel);
    if (targetPanel) targetPanel.hidden = false;
  });
});

document.querySelectorAll(".timer-pill").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".timer-pill").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    timerSeconds = Number(btn.dataset.sec);
  });
});

document.querySelectorAll(".ratio-pill").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".ratio-pill").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentRatio = btn.dataset.ratio;

    if (cameraBox) {
      cameraBox.style.aspectRatio = currentRatio;
      cameraBox.classList.toggle("is-portrait", currentRatio === "3/4");
    }

    capturedPhotos = [];
    updateActionButtons();
    renderStrip();
  });
});

document.querySelectorAll(".grid-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".grid-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentLayout = btn.dataset.layout;
    capturedPhotos = [];
    updateActionButtons();
    renderStrip();
  });
});

function applyGlow() {
  const targetBody = studioBody || document.body;
  const targetHtml = document.documentElement;

  if (glowColor === "none") {
    targetBody.style.setProperty("background-color", "#F4FBFD", "important");
    targetHtml.style.setProperty("background-color", "#F4FBFD", "important");
    if (activeGlowPreview) activeGlowPreview.style.backgroundColor = "#F4FBFD";
    return;
  }

  if (activeGlowPreview) {
    activeGlowPreview.style.backgroundColor = glowColor;
  }

  let hex = glowColor.replace("#", "").trim();
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
    const rgbaColor = `rgba(${r}, ${g}, ${b}, ${glowOpacity})`;
    targetBody.style.setProperty("background-color", rgbaColor, "important");
    targetHtml.style.setProperty("background-color", rgbaColor, "important");
  }
}

document.querySelectorAll(".swatch-btn[data-glow]").forEach((swatch) => {
  swatch.addEventListener("click", () => {
    document.querySelectorAll(".swatch-btn").forEach((s) => s.classList.remove("active"));
    swatch.classList.add("active");
    glowColor = swatch.dataset.glow;
    applyGlow();
  });
});

if (customGlowPicker) {
  const onPickColor = (e) => {
    document.querySelectorAll(".swatch-btn").forEach((s) => s.classList.remove("active"));
    customGlowPicker.parentElement.classList.add("active");
    glowColor = e.target.value;
    applyGlow();
  };

  customGlowPicker.addEventListener("input", onPickColor);
  customGlowPicker.addEventListener("change", onPickColor);
}

if (glowSlider && glowPercent) {
  glowSlider.addEventListener("input", () => {
    glowOpacity = Number(glowSlider.value) / 100;
    glowPercent.textContent = `${glowSlider.value}%`;

    if (glowColor === "none") {
      glowColor = "#FFFFFF";
      document.querySelectorAll(".swatch-btn").forEach((s) => s.classList.remove("active"));
      const whiteSwatch = document.querySelector('.swatch-btn[data-glow="#FFFFFF"]');
      if (whiteSwatch) whiteSwatch.classList.add("active");
    }

    applyGlow();
  });
}

// --- 3. Camera & Filters ---
async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });
    video.srcObject = stream;
    hasCamera = true;
  } catch (err) {
    hasCamera = false;
    shotStatus.textContent = "No camera detected — use Upload Photos!";
    console.error("Camera error:", err);
  }
}

setupFilters(cameraFilterSelect, video, filterOverlayPreview);
initCamera();
updateActionButtons();
renderStrip();

// --- 4. Capture, Shutter Flash & Sequential Upload ---
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function triggerShutterFlash() {
  if (!cameraBox) return;
  cameraBox.classList.remove("shutter-flash");
  void cameraBox.offsetWidth;
  cameraBox.classList.add("shutter-flash");
}

startCaptureBtn.addEventListener("click", async () => {
  if (!hasCamera || !video.srcObject) {
    alert("Walang detected na camera! I-click ang 'Upload Photos' button sa taas para pumili ng pictures.");
    return;
  }

  const total = getRequiredShots();
  capturedPhotos = [];
  startCaptureBtn.disabled = true;
  retakeBtn.disabled = true;
  saveCloudBtn.disabled = true;
  downloadBtn.disabled = true;
  renderStrip();

  for (let shot = 1; shot <= total; shot++) {
    shotStatus.textContent = `Get ready for Shot ${shot} / ${total}...`;
    countdownDisplay.hidden = false;

    for (let count = timerSeconds; count >= 1; count--) {
      countdownDisplay.textContent = count;
      await sleep(1000);
    }

    countdownDisplay.hidden = true;
    triggerShutterFlash();
    captureFromSource(video, true);
    shotStatus.textContent = `Captured (${shot} / ${total} Shots)`;
    renderStrip();

    if (shot < total) await sleep(600);
  }

  startCaptureBtn.disabled = false;
  updateActionButtons();
});

uploadPhotoInput.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files).slice(0, getRequiredShots());
  if (!files.length) return;

  capturedPhotos = [];

  for (const file of files) {
    await new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        captureFromSource(img, false);
        URL.revokeObjectURL(objectUrl);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve();
      };
      img.src = objectUrl;
    });
  }

  updateActionButtons();
  renderStrip();
});

function captureFromSource(source, mirror) {
  const dim = RATIO_DIMENSIONS[currentRatio] || { w: 480, h: 360 };
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = dim.w;
  tempCanvas.height = dim.h;
  const tempCtx = tempCanvas.getContext("2d");

  const srcW = source.videoWidth || source.naturalWidth || dim.w;
  const srcH = source.videoHeight || source.naturalHeight || dim.h;
  const targetRatio = dim.w / dim.h;
  const srcRatio = srcW / srcH;

  let sx = 0, sy = 0, sWidth = srcW, sHeight = srcH;
  if (srcRatio > targetRatio) {
    sWidth = srcH * targetRatio;
    sx = (srcW - sWidth) / 2;
  } else {
    sHeight = srcW / targetRatio;
    sy = (srcH - sHeight) / 2;
  }

  const activeFilter = getActiveFilterObj(cameraFilterSelect);

  tempCtx.save();
  tempCtx.filter = activeFilter.css || "none";
  if (mirror) {
    tempCtx.translate(tempCanvas.width, 0);
    tempCtx.scale(-1, 1);
  }
  tempCtx.drawImage(source, sx, sy, sWidth, sHeight, 0, 0, tempCanvas.width, tempCanvas.height);
  tempCtx.restore();

  if (activeFilter.overlay && filterOverlayPreview && filterOverlayPreview.complete) {
    tempCtx.drawImage(filterOverlayPreview, 0, 0, tempCanvas.width, tempCanvas.height);
  }

  capturedPhotos.push(tempCanvas);
}

function updateActionButtons() {
  const total = getRequiredShots();
  const isComplete = capturedPhotos.length >= total;
  shotStatus.textContent = isComplete
    ? `Complete! (${capturedPhotos.length} / ${total} Shots)`
    : `Ready (${capturedPhotos.length} / ${total} Shots)`;

  retakeBtn.disabled = capturedPhotos.length === 0;
  saveCloudBtn.disabled = !isComplete;
  downloadBtn.disabled = !isComplete;
}

// --- 5. Dynamic Canvas Renderer (Adapts to Ratio & Grid Layout) ---
function renderStrip() {
  const dim = RATIO_DIMENSIONS[currentRatio] || { w: 480, h: 360 };
  const aspect = dim.h / dim.w;
  const padding = 20;
  const gap = 14;
  const footerHeight = 85;
  const shots = getRequiredShots();

  const slots = [];

  if (currentLayout === "4-grid") {
    const slotW = 220;
    const slotH = Math.round(slotW * aspect);
    stripCanvas.width = padding * 2 + slotW * 2 + gap;
    stripCanvas.height = padding + slotH * 2 + gap + footerHeight;

    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        slots.push({
          x: padding + c * (slotW + gap),
          y: padding + r * (slotH + gap),
          w: slotW,
          h: slotH
        });
      }
    }
  } else {
    const slotW = 280;
    const slotH = Math.round(slotW * aspect);
    stripCanvas.width = padding * 2 + slotW;
    stripCanvas.height = padding + shots * slotH + (shots - 1) * gap + footerHeight;

    for (let i = 0; i < shots; i++) {
      slots.push({
        x: padding,
        y: padding + i * (slotH + gap),
        w: slotW,
        h: slotH
      });
    }
  }

  const bgColor = stripThemeSelect.value;
  const isDark = bgColor === "#0F172A";
  const textColor = isDark ? "#F4FBFD" : "#0F172A";

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);

  ctx.strokeStyle = "#0F172A";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, stripCanvas.width - 4, stripCanvas.height - 4);

  slots.forEach((slot, i) => {
    if (capturedPhotos[i]) {
      ctx.drawImage(capturedPhotos[i], slot.x, slot.y, slot.w, slot.h);
    } else {
      ctx.fillStyle = isDark ? "#1E293B" : "#E2E8F0";
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
    }
    ctx.strokeStyle = "#0F172A";
    ctx.lineWidth = 2;
    ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
  });

  const captionText = stripCaptionInput.value.trim() || "SNAPBOOTH";
  const dateText = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.font = "bold 20px Fredoka, sans-serif";
  ctx.fillText(captionText, stripCanvas.width / 2, stripCanvas.height - 50);

  ctx.font = "600 13px Quicksand, sans-serif";
  ctx.fillText(`Photo Booth • ${dateText}`, stripCanvas.width / 2, stripCanvas.height - 22);
}

stripThemeSelect.addEventListener("change", renderStrip);
stripCaptionInput.addEventListener("input", renderStrip);

retakeBtn.addEventListener("click", () => {
  capturedPhotos = [];
  uploadPhotoInput.value = "";
  updateActionButtons();
  renderStrip();
});

downloadBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `snapbooth-${Date.now()}.png`;
  link.href = stripCanvas.toDataURL("image/png");
  link.click();
});

// --- 6. Save to Firestore Cloud & Gallery ---
saveCloudBtn.addEventListener("click", async () => {
  if (!currentUser || capturedPhotos.length < getRequiredShots()) return;

  saveCloudBtn.disabled = true;
  saveCloudBtn.textContent = "Saving...";

  try {
    const imageData = stripCanvas.toDataURL("image/jpeg", 0.72);
    const caption = stripCaptionInput.value.trim() || "SnapBooth Memory";

    await addDoc(collection(db, "strips"), {
      userId: currentUser.uid,
      imageData,
      caption,
      createdAt: serverTimestamp()
    });

    alert("Saved to your Cloud Gallery!");
    loadCloudGallery();
  } catch (error) {
    alert("Save Error: " + error.message);
  } finally {
    saveCloudBtn.disabled = false;
    saveCloudBtn.textContent = "Save to Cloud";
  }
});

if (toggleGalleryBtn && galleryModal) {
  toggleGalleryBtn.addEventListener("click", () => {
    galleryModal.showModal();
    loadCloudGallery();
  });
}

if (closeGalleryBtn && galleryModal) {
  closeGalleryBtn.addEventListener("click", () => {
    galleryModal.close();
  });
}

async function loadCloudGallery() {
  if (!currentUser || !galleryGrid) return;
  galleryGrid.innerHTML = `<p class="empty-gallery-msg">Loading your saved strips...</p>`;

  try {
    const q = query(collection(db, "strips"), where("userId", "==", currentUser.uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      galleryGrid.innerHTML = `<p class="empty-gallery-msg">No saved photo strips yet. Take shots and click "Save to Cloud"!</p>`;
      return;
    }

    const strips = [];
    snapshot.forEach((docSnap) => strips.push({ id: docSnap.id, ...docSnap.data() }));
    strips.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

galleryGrid.innerHTML = "";
    strips.forEach((strip) => {
      const card = document.createElement("article");
      card.className = "gallery-card";

      const img = document.createElement("img");
      img.src = strip.imageData;
      img.alt = strip.caption || "Saved Photo Strip";

      const captionEl = document.createElement("p");
      captionEl.className = "gallery-caption";
      captionEl.textContent = strip.caption;

      const actionsEl = document.createElement("p");
      actionsEl.className = "gallery-actions";

      const downloadLink = document.createElement("a");
      downloadLink.href = strip.imageData;
      downloadLink.download = `snapbooth-${strip.id}.jpg`;
      downloadLink.className = "secondary-btn";
      downloadLink.textContent = "Download";

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "secondary-btn delete-strip-btn";
      deleteBtn.dataset.id = strip.id;
      deleteBtn.textContent = "Delete";

      actionsEl.append(downloadLink, deleteBtn);
      card.append(img, captionEl, actionsEl);
      galleryGrid.appendChild(card);
    });

    galleryGrid.querySelectorAll(".delete-strip-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (confirm("Delete this photo strip?")) {
          await deleteDoc(doc(db, "strips", btn.dataset.id));
          loadCloudGallery();
        }
      });
    });
  } catch (error) {
    galleryGrid.innerHTML = `<p class="empty-gallery-msg">Error loading gallery: ${error.message}</p>`;
  }
}