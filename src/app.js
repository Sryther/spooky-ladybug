/* ===========================================================================
   Photomaton d'Halloween — Cox Animation
   Application 100 % statique : la caméra, le cadre et la photo restent dans
   le navigateur. Aucun envoi réseau, aucun stockage (ni cookie, ni
   localStorage) : tout disparaît à la fermeture de la page.
   =========================================================================== */

"use strict";

/* --- Format de la photo finale : 4:5 en portrait, 5:4 en paysage ---------- */
const OUT_SHORT = 1080;
const OUT_LONG = 1350;
const outSize = (landscape) =>
  landscape ? { w: OUT_LONG, h: OUT_SHORT } : { w: OUT_SHORT, h: OUT_LONG };
const FILE_NAME = "halloween-cox-animation.jpg";
const SHARE_TEXT = "Notre petit monstre au photomaton d'Halloween de Cox Animation 🎃👻";

/* --- Réseaux sociaux : légende prête à coller + où publier ---------------- */
/* Aucun réseau ne permet de publier une photo locale via un simple lien :
   on prépare donc la légende (copiée) et la photo (menu de partage natif). */
const NETWORKS = {
  facebook: { name: "Facebook", tags: "#CoxAnimation #Halloween", url: "https://www.facebook.com/" },
  instagram: { name: "Instagram", tags: "#CoxAnimation #Halloween #HalloweenKids", url: "https://www.instagram.com/" },
  tiktok: { name: "TikTok", tags: "#CoxAnimation #Halloween #halloweenkids", url: "https://www.tiktok.com/upload" },
  snapchat: { name: "Snapchat", tags: "#CoxAnimation #Halloween", url: "https://www.snapchat.com/" },
};

/* --- Les cadres (SVG à fenêtre transparente, dans assets/frames/) -------- */
const FRAMES = [
  { key: "citrouilles", label: "Citrouilles", emoji: "🎃", title: "Joyeux Halloween !", color: "#ff8a2a" },
  { key: "fantomes", label: "Fantômes", emoji: "👻", title: "Bouh !", color: "#d9ceff" },
  { key: "araignees", label: "Araignées", emoji: "🕷️", title: "Même pas peur !", color: "#9be35a" },
];

/* --- État (en mémoire uniquement) ----------------------------------------- */
const state = {
  frame: FRAMES[0],
  facing: "environment", // les parents photographient les enfants : caméra arrière par défaut
  stream: null,
  rafId: 0,
  landscape: false, // orientation de la photo en cours (vidéo ou image)
  shot: null, // canvas hors-écran contenant la photo brute (jamais envoyée)
  blob: null,
  photoUrl: "",
};

const $ = (id) => document.getElementById(id);
const views = { intro: $("view-intro"), camera: $("view-camera"), result: $("view-result") };
const preview = $("preview");
const previewCtx = preview.getContext("2d");

/* --- Chargement des ressources graphiques -------------------------------- */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const logoReady = loadImage("assets/logo-spooky.png");
// Chaque cadre existe en portrait et en paysage (suffixe « -paysage »).
const frameSrc = (f, landscape) => `assets/frames/${f.key}${landscape ? "-paysage" : ""}.svg`;
const framesReady = Promise.all(
  FRAMES.map(async (f) => {
    const [portrait, landscape] = await Promise.all([loadImage(frameSrc(f, false)), loadImage(frameSrc(f, true))]);
    f.img = { portrait, landscape };
  })
);
// Les polices doivent être chargées avant de dessiner du texte sur le canvas.
const fontsReady = Promise.all([
  document.fonts.load('64px "Creepster"'),
  document.fonts.load('700 32px "Fredoka"'),
]).catch(() => {});

/* --- Navigation ------------------------------------------------------------ */
function show(name) {
  for (const [key, el] of Object.entries(views)) el.hidden = key !== name;
  $("xmas").hidden = name !== "result";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* --- Dessin : photo + cadre + bandeaux ------------------------------------- */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Dessine la source (vidéo, image ou canvas) recadrée « cover », puis le cadre. */
function compose(ctx, w, h, source, srcW, srcH, mirror, frame, logo) {
  const s = Math.min(w, h) / OUT_SHORT;
  ctx.save();
  ctx.fillStyle = "#1b1030";
  ctx.fillRect(0, 0, w, h);

  if (source && srcW && srcH) {
    const scale = Math.max(w / srcW, h / srcH);
    const dw = srcW * scale;
    const dh = srcH * scale;
    if (mirror) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  if (frame.img) ctx.drawImage(w > h ? frame.img.landscape : frame.img.portrait, 0, 0, w, h);

  // Titre en haut
  ctx.font = `${Math.round(78 * s)}px "Creepster", "Fredoka", cursive`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(frame.title).width + 70 * s;
  roundRect(ctx, (w - tw) / 2, 22 * s, tw, 108 * s, 54 * s);
  ctx.fillStyle = "rgba(22, 11, 38, 0.88)";
  ctx.fill();
  ctx.lineWidth = 5 * s;
  ctx.strokeStyle = frame.color;
  ctx.stroke();
  ctx.fillStyle = frame.color;
  ctx.fillText(frame.title, w / 2, 80 * s);

  // Signature de l'association en bas
  const label = "Cox Animation · Halloween 2026";
  ctx.font = `700 ${Math.round(34 * s)}px "Fredoka", sans-serif`;
  const logoH = 74 * s;
  const logoW = logo ? (logo.width / logo.height) * logoH : 0;
  const pw = ctx.measureText(label).width + logoW + 64 * s;
  const px = (w - pw) / 2;
  const py = h - 112 * s;
  roundRect(ctx, px, py, pw, 82 * s, 41 * s);
  ctx.fillStyle = "rgba(255, 248, 239, 0.94)";
  ctx.fill();
  if (logo) ctx.drawImage(logo, px + 24 * s, py + 4 * s, logoW, logoH);
  ctx.fillStyle = "#2a1845";
  ctx.textAlign = "left";
  ctx.fillText(label, px + 34 * s + logoW, py + 43 * s);
  ctx.restore();
}

/* --- Caméra ---------------------------------------------------------------- */
async function startCamera() {
  stopCamera();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("unsupported");
  }
  state.stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: state.facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
  });
  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = true;
  video.srcObject = state.stream;
  await video.play();
  state.video = video;
  // La caméra avant est affichée en miroir, comme un vrai miroir.
  const settings = state.stream.getVideoTracks()[0].getSettings();
  state.mirror = settings.facingMode ? settings.facingMode === "user" : state.facing === "user";
  renderLoop();
}

function stopCamera() {
  cancelAnimationFrame(state.rafId);
  if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
  state.stream = null;
  if (state.video) state.video.srcObject = null;
  state.video = null;
}

async function renderLoop() {
  const logo = await logoReady.catch(() => null);
  const tick = () => {
    const v = state.video;
    if (!v) return;
    // Téléphone tourné : l'aperçu et le cadre passent en paysage (et inversement).
    const landscape = v.videoWidth > v.videoHeight;
    if (landscape !== state.landscape || preview.width !== (landscape ? 900 : 720)) {
      setOrientation(landscape);
      preview.width = landscape ? 900 : 720;
      preview.height = landscape ? 720 : 900;
    }
    compose(previewCtx, preview.width, preview.height, v, v.videoWidth, v.videoHeight, state.mirror, state.frame, logo);
    state.rafId = requestAnimationFrame(tick);
  };
  tick();
}

async function openCamera() {
  const err = $("intro-error");
  err.hidden = true;
  await Promise.all([framesReady, fontsReady]).catch(() => {});
  try {
    show("camera");
    await startCamera();
  } catch (e) {
    stopCamera();
    show("intro");
    err.textContent =
      e && e.name === "NotAllowedError"
        ? "L'accès à l'appareil photo a été refusé. Autorisez-le dans les réglages du navigateur, ou choisissez une photo existante."
        : "Impossible d'ouvrir l'appareil photo sur cet appareil. Vous pouvez choisir une photo existante à la place.";
    err.hidden = false;
  }
}

/* --- Photo : capture, rendu final, enregistrement ------------------------- */
function capture() {
  const v = state.video;
  if (!v || !v.videoWidth) return;
  // On garde l'image brute en mémoire pour pouvoir changer de cadre ensuite.
  const shot = document.createElement("canvas");
  shot.width = v.videoWidth;
  shot.height = v.videoHeight;
  const ctx = shot.getContext("2d");
  if (state.mirror) {
    ctx.translate(shot.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(v, 0, 0);
  state.shot = shot;

  stopCamera();
  renderResult();
}

async function renderResult() {
  if (!state.shot) return;
  const logo = await logoReady.catch(() => null);
  await Promise.all([framesReady, fontsReady]).catch(() => {});
  setOrientation(state.shot.width > state.shot.height);
  const { w, h } = outSize(state.landscape);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  compose(out.getContext("2d"), w, h, state.shot, state.shot.width, state.shot.height, false, state.frame, logo);

  const blob = await new Promise((resolve) => out.toBlob(resolve, "image/jpeg", 0.9));
  releasePhoto();
  state.blob = blob;
  state.photoUrl = URL.createObjectURL(blob); // URL locale « blob: », valable uniquement dans cet onglet
  $("photo").src = state.photoUrl;
  $("btn-save").href = state.photoUrl;
  show("result");
}

function releasePhoto() {
  if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
  state.photoUrl = "";
  state.blob = null;
}

function forgetEverything() {
  stopCamera();
  releasePhoto();
  state.shot = null;
  $("photo").removeAttribute("src");
  $("btn-save").removeAttribute("href");
  previewCtx.clearRect(0, 0, preview.width, preview.height);
}

async function useFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const shot = document.createElement("canvas");
    shot.width = img.naturalWidth;
    shot.height = img.naturalHeight;
    shot.getContext("2d").drawImage(img, 0, 0);
    state.shot = shot;
    resetShare();
    await renderResult();
  } catch {
    $("intro-error").textContent = "Cette image n'a pas pu être ouverte. Essayez avec une autre photo.";
    $("intro-error").hidden = false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* --- Partage (proposé discrètement, jamais automatique) ------------------- */
function resetShare() {
  $("share").hidden = false;
  $("share-ask").hidden = false;
  $("networks").hidden = true;
  $("share-hint").hidden = true;
}

function hint(text) {
  $("share-hint").textContent = text;
  $("share-hint").hidden = false;
}

async function shareTo(key) {
  const net = NETWORKS[key];
  if (!state.blob || !net) return;
  const caption = `${SHARE_TEXT} ${net.tags}`;
  // Pas d'await : Safari exige que navigator.share() suive directement le geste.
  const copied = navigator.clipboard
    ? navigator.clipboard.writeText(caption).then(() => true, () => false)
    : Promise.resolve(false);

  const file = new File([state.blob], FILE_NAME, { type: "image/jpeg" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    hint(`Choisissez ${net.name} dans le menu de partage.`);
    try {
      // C'est le téléphone qui transmet la photo à l'appli choisie.
      await navigator.share({ files: [file], text: caption });
      hint((await copied)
        ? `Légende copiée ✔ Il ne reste qu'à la coller dans ${net.name}.`
        : `Légende à coller dans ${net.name} : ${caption}`);
    } catch (e) {
      if (e && e.name === "AbortError") $("share-hint").hidden = true;
      else hint(`Le partage n'a pas fonctionné. Enregistrez la photo puis publiez-la depuis ${net.name}.`);
    }
    return;
  }

  // Ordinateur ou navigateur sans partage de fichiers : on enregistre la photo
  // puis on ouvre le réseau choisi.
  $("btn-save").click();
  window.open(net.url, "_blank", "noopener");
  hint((await copied)
    ? `Photo enregistrée et légende copiée ✔ Publiez-la depuis ${net.name}.`
    : `Photo enregistrée ✔ Publiez-la depuis ${net.name} avec la légende : ${caption}`);
}

/* --- Sélecteur de cadre ---------------------------------------------------- */
function buildFramePickers() {
  document.querySelectorAll("[data-frames]").forEach((group) => {
    group.innerHTML = "";
    for (const f of FRAMES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "frame";
      b.setAttribute("role", "radio");
      b.dataset.key = f.key;
      b.innerHTML = `<img src="assets/frames/${f.key}.svg" alt="" width="54" height="68" /><span>${f.emoji} ${f.label}</span>`;
      b.addEventListener("click", () => selectFrame(f));
      group.appendChild(b);
    }
  });
  syncFramePickers();
}

function syncFramePickers() {
  document.querySelectorAll(".frame").forEach((b) => {
    b.setAttribute("aria-checked", String(b.dataset.key === state.frame.key));
  });
}

function setOrientation(landscape) {
  state.landscape = landscape;
  document.querySelector(".stage").classList.toggle("is-landscape", landscape);
  document.querySelectorAll(".frame").forEach((b) => {
    b.classList.toggle("is-landscape", landscape);
    b.querySelector("img").src = frameSrc(FRAMES.find((f) => f.key === b.dataset.key), landscape);
  });
}

function selectFrame(f) {
  state.frame = f;
  syncFramePickers();
  if (!views.result.hidden) renderResult();
}

/* --- Événements ------------------------------------------------------------ */
$("btn-start").addEventListener("click", openCamera);
$("file-input").addEventListener("change", (e) => {
  useFile(e.target.files[0]);
  e.target.value = "";
});
$("btn-back").addEventListener("click", () => {
  forgetEverything();
  show("intro");
});
$("btn-flip").addEventListener("click", async () => {
  state.facing = state.facing === "user" ? "environment" : "user";
  try {
    await startCamera();
  } catch {
    state.facing = state.facing === "user" ? "environment" : "user";
    await startCamera().catch(() => {});
  }
});
$("btn-shoot").addEventListener("click", () => {
  resetShare();
  capture();
});
$("btn-again").addEventListener("click", () => {
  forgetEverything();
  openCamera();
});
$("btn-share").addEventListener("click", () => {
  $("share-ask").hidden = true;
  $("networks").hidden = false;
});
document.querySelectorAll(".net").forEach((b) => b.addEventListener("click", () => shareTo(b.dataset.net)));
$("btn-noshare").addEventListener("click", () => { $("share").hidden = true; });

// Libère la caméra dès que la page n'est plus visible, et oublie tout en partant.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.stream) {
    stopCamera();
    if (!views.camera.hidden) show("intro");
  }
});
window.addEventListener("pagehide", forgetEverything);
window.addEventListener("pageshow", (e) => { if (e.persisted) show("intro"); });

buildFramePickers();
