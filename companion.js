// Lazy-loaded VRM companion — only runs when a visitor taps "say hi".
// Ported from the companion project's VRMCharacter (three-vrm 3.4 / three 0.170),
// no build step: ESM imports from a CDN with three pinned so three-vrm shares it.
import * as THREE from 'https://esm.sh/three@0.170.0';
import { GLTFLoader } from 'https://esm.sh/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from 'https://esm.sh/@pixiv/three-vrm@3.4.0?deps=three@0.170.0';

const PILLS = [
  { label: "who's gurkeerat? 🤔",
    say: "a CS · stats · math student at UofT who actually ships AI — a fine-tuned, self-hosted voice model + a suite of real-time LLM agents. and yep, he's hunting an AI/ML internship 👀" },
  { label: "show me the good stuff ✨", scroll: "#work",
    say: "scroll up a touch — the Voice Agent and Saleable are right there 👆 those are his babies." },
  { label: "how do i reach him? 💌", scroll: "footer",
    say: "easiest: gurkeeratsappal@gmail.com — or the github / linkedin links at the bottom 👇" },
  { label: "wait, are you real? 👀",
    say: "i'm a VRM avatar he borrowed from another of his projects + a few canned lines for now. give him an internship and maybe he'll wire me up to a real LLM 😉" },
];

let started = false;

function injectStyles() {
  if (document.getElementById('cmp-styles')) return;
  const s = document.createElement('style');
  s.id = 'cmp-styles';
  s.textContent = `
  #cmp-panel{position:fixed;right:20px;bottom:20px;z-index:50;width:300px;max-width:calc(100vw - 28px);
    height:470px;max-height:calc(100vh - 40px);display:flex;flex-direction:column;
    background:var(--bg);border:1px solid var(--line);border-radius:16px;overflow:hidden;
    box-shadow:0 18px 50px rgba(0,0,0,.22)}
  #cmp-canvas{flex:1 1 0;min-height:0;width:100%;display:block;cursor:grab}
  #cmp-close{position:absolute;top:8px;right:10px;z-index:2;background:var(--chip);border:1px solid var(--line);
    color:var(--fg);width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:15px;line-height:1}
  #cmp-bubble{flex:0 0 auto;margin:10px 12px 0;padding:10px 12px;background:var(--chip);
    border:1px solid var(--line);border-radius:12px;font-size:13px;color:var(--fg);
    max-height:96px;overflow-y:auto}
  #cmp-pills{flex:0 0 auto;display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px 12px}
  #cmp-pills button{font:inherit;font-size:12px;padding:5px 10px;border-radius:999px;cursor:pointer;
    background:transparent;border:1px solid var(--line);color:var(--fg)}
  #cmp-pills button:hover{border-color:var(--accent);color:var(--accent)}
  #cmp-credit{flex:0 0 auto;padding:0 12px 10px;font-size:10px;color:var(--muted);opacity:.7}
  #cmp-credit a{color:inherit}
  `;
  document.head.appendChild(s);
}

function buildUI() {
  const panel = document.createElement('div');
  panel.id = 'cmp-panel';
  panel.innerHTML = `
    <button id="cmp-close" aria-label="close">×</button>
    <canvas id="cmp-canvas"></canvas>
    <div id="cmp-bubble"></div>
    <div id="cmp-pills"></div>
    <div id="cmp-credit">avatar: メカクレ少女 by ギリギリチャンネル · <a href="https://hub.vroid.com" target="_blank" rel="noopener">VRoid Hub</a></div>`;
  document.body.appendChild(panel);
  return {
    panel,
    canvas: panel.querySelector('#cmp-canvas'),
    bubble: panel.querySelector('#cmp-bubble'),
    pills: panel.querySelector('#cmp-pills'),
    closeBtn: panel.querySelector('#cmp-close'),
  };
}

export function initCompanion() {
  if (started) return;
  started = true;
  injectStyles();
  const { panel, canvas, bubble, pills, closeBtn } = buildUI();

  const mouse = { x: 0, y: 0, idle: 99 };
  panel.addEventListener('pointermove', (e) => {
    const r = panel.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    mouse.idle = 0;
  });
  panel.addEventListener('pointerleave', () => { mouse.x = 0; mouse.y = 0; mouse.idle = 99; });

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 1.38, 1.45);
  camera.lookAt(0, 1.32, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xfff5ec, 1.0); key.position.set(1.5, 2, 2); scene.add(key);
  const fill = new THREE.DirectionalLight(0xdcd8f0, 0.35); fill.position.set(-1.5, 1, 1); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffb499, 0.7); rim.position.set(0, 2, -1.5); scene.add(rim);

  function resize() {
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 300;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize(); window.addEventListener('resize', resize);

  const lookTarget = new THREE.Object3D(); scene.add(lookTarget);
  let vrm = null, t = 0;
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  bubble.textContent = 'hold on, materializing… ✨';
  loader.load('avatar.vrm', (gltf) => {
    vrm = gltf.userData.vrm;
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(vrm); // VRM 0.x faces -Z; flip it to +Z (no-op for VRM 1.0) — version-agnostic
    if (vrm.lookAt) vrm.lookAt.target = lookTarget;
    scene.add(vrm.scene);
    bubble.textContent = "hi! i'm gurkeerat's lil AI companion 🌸 tap a button:";
    renderPills();
  }, undefined, (err) => {
    bubble.textContent = "ngh, i couldn't load 😣";
    console.error('[companion] vrm load failed', err);
  });

  const clock = new THREE.Clock();
  let headYaw = 0, headPitch = 0, blinkTimer = 1.5 + Math.random() * 2, blinkPhase = 0;
  function loop() {
    if (!started) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (vrm) {
      t += dt;
      mouse.idle += dt;
      const h = vrm.humanoid;
      // breathing — spine + chest rise and fall
      const breathe = Math.sin(t * 1.7);
      const spine = h?.getNormalizedBoneNode('spine');
      if (spine) spine.rotation.x = breathe * 0.022;
      const chest = h?.getNormalizedBoneNode('chest') || h?.getNormalizedBoneNode('upperChest');
      if (chest) chest.rotation.x = breathe * 0.018;
      // slow weight-shift sway
      const hips = h?.getNormalizedBoneNode('hips');
      if (hips) hips.rotation.z = Math.sin(t * 0.6) * 0.02;
      // head: track cursor if recently moved, else gentle idle look-around (no mouse needed)
      const active = mouse.idle < 1.6;
      const tgtYaw = active ? mouse.x * 0.42 : Math.sin(t * 0.45) * 0.20;
      const tgtPitch = active ? -mouse.y * 0.26 : Math.sin(t * 0.33 + 1) * 0.07;
      headYaw += (tgtYaw - headYaw) * Math.min(1, dt * 3.5);
      headPitch += (tgtPitch - headPitch) * Math.min(1, dt * 3.5);
      const neck = h?.getNormalizedBoneNode('neck');
      const head = h?.getNormalizedBoneNode('head');
      if (neck) { neck.rotation.y = headYaw * 0.45; neck.rotation.x = headPitch * 0.45; }
      if (head) { head.rotation.y = headYaw * 0.55; head.rotation.x = headPitch * 0.55; }
      // eyes follow roughly the same direction
      lookTarget.position.set(headYaw * 2.5, 1.45 + headPitch * 2.0, 3.0);
      lookTarget.updateMatrixWorld();
      // natural, randomly-timed blink
      blinkTimer -= dt;
      if (blinkTimer <= 0 && blinkPhase === 0) blinkPhase = 0.0001;
      if (blinkPhase > 0) {
        blinkPhase += dt;
        const v = blinkPhase < 0.07 ? blinkPhase / 0.07
                : blinkPhase < 0.14 ? 1 - (blinkPhase - 0.07) / 0.07 : 0;
        vrm.expressionManager?.setValue('blink', Math.max(0, Math.min(1, v)));
        if (blinkPhase >= 0.14) { blinkPhase = 0; blinkTimer = 1.8 + Math.random() * 3; }
      }
      vrm.update(dt);
    }
    renderer.render(scene, camera);
  }
  loop();

  function renderPills() {
    pills.innerHTML = '';
    PILLS.forEach((p) => {
      const b = document.createElement('button');
      b.textContent = p.label;
      b.onclick = () => {
        bubble.textContent = p.say;
        if (p.scroll) document.querySelector(p.scroll)?.scrollIntoView({ behavior: 'smooth' });
      };
      pills.appendChild(b);
    });
  }

  closeBtn.onclick = () => {
    started = false;
    window.removeEventListener('resize', resize);
    renderer.dispose();
    panel.remove();
    const summon = document.getElementById('summon-btn');
    if (summon) summon.style.display = '';
  };
}
