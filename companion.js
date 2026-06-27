// Lazy-loaded VRM "desktop pet" — a full-screen, transparent, click-through overlay.
// She wanders left<->right with a little walk, a speech bubble floats above her head.
// The page stays fully usable (pointer-events:none on the stage).
import * as THREE from 'https://esm.sh/three@0.170.0';
import { GLTFLoader } from 'https://esm.sh/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from 'https://esm.sh/@pixiv/three-vrm@3.4.0?deps=three@0.170.0';

const LINES = [
  "hi! i'm gurkeerat's lil AI companion 🌸",
  "his projects are up there — scroll up 👆",
  "he's hunting an AI/ML internship 👀",
  "fine-tuned voice models, LLM agents… the works",
  "wanna reach him? his email's at the bottom 💌",
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
  #cmp-credit{position:fixed;left:12px;bottom:12px;z-index:46;pointer-events:auto;
    font-size:10px;color:var(--muted);opacity:.6}
  #cmp-credit a{color:inherit}
  `;
  document.head.appendChild(s);
}

export function initCompanion() {
  if (started) return;
  started = true;
  injectStyles();

  const stage = document.createElement('div');
  stage.id = 'cmp-stage';
  stage.innerHTML = `<canvas id="cmp-canvas"></canvas><div id="cmp-bubble"></div>`;
  document.body.appendChild(stage);
  const close = document.createElement('button');
  close.id = 'cmp-close'; close.textContent = '✕ hide';
  const credit = document.createElement('div');
  credit.id = 'cmp-credit';
  credit.innerHTML = 'avatar: メカクレ少女 by ギリギリチャンネル · <a href="https://hub.vroid.com" target="_blank" rel="noopener">VRoid Hub</a>';
  document.body.appendChild(close);
  document.body.appendChild(credit);

  const canvas = stage.querySelector('#cmp-canvas');
  const bubble = stage.querySelector('#cmp-bubble');

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.0, 3.0);   // full-body framing with room to roam
  camera.lookAt(0, 1.0, 0);
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

  const lookTarget = new THREE.Object3D(); scene.add(lookTarget);
  let vrm = null, baseY = 0, t = 0;
  let posX = 0, dir = 1, walking = true, pauseT = 0, turn = 0;
  let blinkTimer = 2 + Math.random() * 2, blinkPhase = 0;
  let bubbleOn = false, lineTimer = 0.6, lineI = 0;
  const RANGE = 1.25, SPEED = 0.42, STEP = 7.0;

  const loader = new GLTFLoader();
  loader.register((p) => new VRMLoaderPlugin(p));
  loader.load('avatar.vrm', (gltf) => {
    vrm = gltf.userData.vrm;
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(vrm);
    baseY = vrm.scene.rotation.y;
    if (vrm.lookAt) vrm.lookAt.target = lookTarget;
    scene.add(vrm.scene);
  }, undefined, (e) => {
    console.error('[companion] load failed', e);
    bubble.textContent = "couldn't load me 😣"; bubble.style.opacity = 1;
    bubble.style.left = '50%'; bubble.style.top = '40%';
  });

  const B = (name) => vrm.humanoid?.getNormalizedBoneNode(name);

  const clock = new THREE.Clock();
  function loop() {
    if (!started) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (vrm) {
      t += dt;
      // wander: walk to an edge, pause, turn around
      if (walking) {
        posX += dir * SPEED * dt;
        if (Math.abs(posX) >= RANGE) { posX = Math.sign(posX) * RANGE; walking = false; pauseT = 1.3 + Math.random(); }
      } else {
        pauseT -= dt;
        if (pauseT <= 0) { walking = true; dir *= -1; }
      }
      const moving = walking ? 1 : 0;
      const ph = t * STEP;

      // face direction of travel (¾ turn), face camera when paused
      const targetTurn = walking ? (dir > 0 ? -0.7 : 0.7) : 0;
      turn += (targetTurn - turn) * Math.min(1, dt * 4);
      vrm.scene.rotation.y = baseY + turn;
      vrm.scene.position.x = posX;
      vrm.scene.position.y = moving * Math.abs(Math.sin(ph)) * 0.04; // step bob

      // legs (arms-down handled below). Flip leg signs if she moonwalks.
      const lUL = B('leftUpperLeg'), rUL = B('rightUpperLeg');
      if (lUL) lUL.rotation.x = moving * Math.sin(ph) * 0.4;
      if (rUL) rUL.rotation.x = moving * -Math.sin(ph) * 0.4;
      const lLL = B('leftLowerLeg'), rLL = B('rightLowerLeg');
      if (lLL) lLL.rotation.x = moving * Math.max(0, -Math.sin(ph)) * 0.5;
      if (rLL) rLL.rotation.x = moving * Math.max(0, Math.sin(ph)) * 0.5;

      // arms down out of the T-pose, with a little walk swing.
      // (If her arms point UP instead of down, flip these two signs.)
      const lUA = B('leftUpperArm'), rUA = B('rightUpperArm');
      if (lUA) { lUA.rotation.z = 1.2; lUA.rotation.x = moving * -Math.sin(ph) * 0.18; }
      if (rUA) { rUA.rotation.z = -1.2; rUA.rotation.x = moving * Math.sin(ph) * 0.18; }

      // breathing + idle head sway (counter-rotate so face stays toward us)
      const spine = B('spine'); if (spine) spine.rotation.x = Math.sin(t * 1.6) * 0.015;
      const head = B('head'); if (head) head.rotation.y = Math.sin(t * 0.5) * 0.12 - turn * 0.5;
      lookTarget.position.set(posX, 1.4, 3); lookTarget.updateMatrixWorld();

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
    window.removeEventListener('resize', resize);
    renderer.dispose();
    stage.remove(); close.remove(); credit.remove();
    const summon = document.getElementById('summon-btn');
    if (summon) summon.style.display = '';
  };
}
