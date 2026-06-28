// Lazy-loaded VRM "desktop pet" — full-screen, transparent, click-through overlay.
// She stands on the right and does a smooth procedural idle (breathing, weight-shift,
// head sway, arm sway, blink). The page stays usable (pointer-events:none on the stage).
import * as THREE from 'https://esm.sh/three@0.170.0';
import { GLTFLoader } from 'https://esm.sh/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from 'https://esm.sh/@pixiv/three-vrm@3.4.0?deps=three@0.170.0';

const LINES = [
  "hi! i'm gurkeerat's lil AI companion 🌸",
  "his projects are up there — scroll up 👆",
  "he's hunting an AI/ML internship 👀",
  "fine-tuned voice models, LLM agents… the works",
  "wanna reach him? his email's at the bottom 💌",
  "psst — that voice agent? he fine-tuned + self-hosts it 🎙️",
  "Saleable's a whole suite of AI agents he shipped 🏠",
  "he ships end-to-end: model → backend → frontend → deployed ⚡",
  "cs · stats · math @ UofT, if you were wondering 🎓",
  "Toronto-based, but totally down for remote too 🇨🇦",
  "honestly he'll out-build the résumé — give him a shot 😤",
  "i'm just a lil VRM he set loose on his site 😌",
  "still here? he's genuinely worth a reply 💌",
  "he builds AI agents… so yeah, i'm kind of the demo 😏",
];

let started = false;

function injectStyles() {
  if (document.getElementById('cmp-styles')) return;
  const s = document.createElement('style');
  s.id = 'cmp-styles';
  s.textContent = `
  #cmp-stage{position:fixed;inset:0;z-index:45;pointer-events:none;overflow:hidden}
  #cmp-canvas{width:100%;height:100%;display:block}
  #cmp-bubble{position:absolute;left:0;top:0;max-width:240px;transform:translate(-50%,-100%);
    background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:9px 12px;
    font-size:13px;line-height:1.35;color:var(--fg);box-shadow:0 10px 30px rgba(0,0,0,.16);
    opacity:0;transition:opacity .45s ease;pointer-events:none}
  #cmp-close{position:fixed;right:16px;bottom:16px;z-index:46;pointer-events:auto;cursor:pointer;
    background:var(--chip);border:1px solid var(--line);color:var(--fg);border-radius:999px;
    padding:6px 13px;font:inherit;font-size:12px}
  #cmp-close:hover{border-color:var(--accent);color:var(--accent)}
  `;
  document.head.appendChild(s);
}

export function initCompanion() {
  if (started) return;
  started = true;
  injectStyles();
  document.documentElement.classList.add('cmp-active');

  const stage = document.createElement('div');
  stage.id = 'cmp-stage';
  stage.innerHTML = `<canvas id="cmp-canvas"></canvas><div id="cmp-bubble"></div>`;
  document.body.appendChild(stage);
  const close = document.createElement('button');
  close.id = 'cmp-close'; close.textContent = '✕ hide';
  document.body.appendChild(close);

  const canvas = stage.querySelector('#cmp-canvas');
  const bubble = stage.querySelector('#cmp-bubble');

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.90, 3.5);  // full body in frame, feet near the bottom edge
  camera.lookAt(0, 0.90, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const keyL = new THREE.DirectionalLight(0xfff5ec, 1.0); keyL.position.set(2, 3, 2); scene.add(keyL);
  const fillL = new THREE.DirectionalLight(0xdce4ff, 0.4); fillL.position.set(-2, 1, 1.5); scene.add(fillL);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize(); window.addEventListener('resize', resize);

  let vrm = null, baseY = 0, t = 0;
  let blinkTimer = 2 + Math.random() * 2, blinkPhase = 0;
  let bubbleOn = false, lineTimer = 0.6, lineI = 0;
  const HOME_X = 1.0;
  const B = (n) => vrm.humanoid?.getNormalizedBoneNode(n);

  // soft contact shadow so she's grounded, not floating
  const shCanvas = document.createElement('canvas'); shCanvas.width = shCanvas.height = 128;
  const shCtx = shCanvas.getContext('2d');
  const grd = shCtx.createRadialGradient(64, 64, 3, 64, 64, 60);
  grd.addColorStop(0, 'rgba(0,0,0,0.33)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  shCtx.fillStyle = grd; shCtx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.55),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shCanvas), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(HOME_X, 0.01, 0.06);
  scene.add(shadow);

  const loader = new GLTFLoader();
  loader.register((p) => new VRMLoaderPlugin(p));
  loader.load('avatar.vrm', (gltf) => {
    vrm = gltf.userData.vrm;
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(vrm);
    baseY = vrm.scene.rotation.y;
    scene.add(vrm.scene);
  }, undefined, (e) => {
    console.error('[companion] avatar load failed', e);
    bubble.textContent = "couldn't load me 😣"; bubble.style.opacity = 1;
    bubble.style.left = '50%'; bubble.style.top = '40%';
  });

  const clock = new THREE.Clock();
  function loop() {
    if (!started) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (vrm) {
      t += dt;
      // light procedural idle: breathing, gentle sway, head drift, arms resting at sides
      const breathe = Math.sin(t * 1.5);
      const spine = B('spine'); if (spine) { spine.rotation.x = breathe * 0.04; spine.rotation.z = Math.sin(t * 0.6) * 0.035; }
      const chest = B('chest') || B('upperChest'); if (chest) chest.rotation.x = breathe * 0.025;
      const hips = B('hips'); if (hips) hips.rotation.z = Math.sin(t * 0.7) * 0.045;
      const neck = B('neck'); if (neck) neck.rotation.y = Math.sin(t * 0.55) * 0.08;
      const head = B('head'); if (head) { head.rotation.y = Math.sin(t * 0.55) * 0.18; head.rotation.x = Math.sin(t * 0.42) * 0.07; head.rotation.z = Math.sin(t * 0.5) * 0.03; }
      const lUA = B('leftUpperArm'), rUA = B('rightUpperArm');
      const lLA = B('leftLowerArm'), rLA = B('rightLowerArm');
      if (lUA) { lUA.rotation.z = 1.42 + Math.sin(t * 0.8) * 0.05; lUA.rotation.x = Math.sin(t * 0.9) * 0.05; }
      if (rUA) { rUA.rotation.z = -1.42 - Math.sin(t * 0.8 + 0.6) * 0.05; rUA.rotation.x = Math.sin(t * 0.9 + 0.6) * 0.05; }
      if (lLA) lLA.rotation.x = -0.16 + Math.sin(t * 0.9) * 0.05;
      if (rLA) rLA.rotation.x = -0.16 + Math.sin(t * 0.9 + 0.6) * 0.05;
      vrm.scene.position.y = breathe * 0.02;
      vrm.scene.position.x = HOME_X;
      vrm.scene.rotation.y = baseY;

      // blink
      blinkTimer -= dt;
      if (blinkTimer <= 0 && blinkPhase === 0) blinkPhase = 0.0001;
      if (blinkPhase > 0) {
        blinkPhase += dt;
        const v = blinkPhase < 0.07 ? blinkPhase / 0.07 : blinkPhase < 0.14 ? 1 - (blinkPhase - 0.07) / 0.07 : 0;
        vrm.expressionManager?.setValue('blink', Math.max(0, Math.min(1, v)));
        if (blinkPhase >= 0.14) { blinkPhase = 0; blinkTimer = 2 + Math.random() * 3; }
      }

      vrm.update(dt);

      // speech bubble: cycle lines (5.5s on, 4s off), follow her head on screen
      lineTimer -= dt;
      if (lineTimer <= 0) {
        if (bubbleOn) { bubble.style.opacity = '0'; bubbleOn = false; lineTimer = 4; }
        else { bubble.textContent = LINES[lineI++ % LINES.length]; bubble.style.opacity = '1'; bubbleOn = true; lineTimer = 5.5; }
      }
      const hn = B('head');
      if (hn) {
        const p = new THREE.Vector3(); hn.getWorldPosition(p); p.y += 0.3; p.project(camera);
        bubble.style.left = ((p.x * 0.5 + 0.5) * window.innerWidth) + 'px';
        bubble.style.top = ((-p.y * 0.5 + 0.5) * window.innerHeight) + 'px';
      }
    }
    renderer.render(scene, camera);
  }
  loop();

  close.onclick = () => {
    started = false;
    document.documentElement.classList.remove('cmp-active');
    window.removeEventListener('resize', resize);
    renderer.dispose();
    stage.remove(); close.remove();
    const summon = document.getElementById('summon-btn');
    if (summon) summon.style.display = '';
  };
}
