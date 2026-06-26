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
    <div id="cmp-pills"></div>`;
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

  const mouse = { x: 0, y: 0 };
  panel.addEventListener('pointermove', (e) => {
    const r = panel.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  });
  panel.addEventListener('pointerleave', () => { mouse.x = 0; mouse.y = 0; });

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
    vrm.scene.rotation.y = 0; // VRM 1.0 already faces +Z, toward the camera — no flip needed
    if (vrm.lookAt) vrm.lookAt.target = lookTarget;
    scene.add(vrm.scene);
    bubble.textContent = "hi! i'm gurkeerat's lil AI companion 🌸 tap a button:";
    renderPills();
  }, undefined, (err) => {
    bubble.textContent = "ngh, i couldn't load 😣";
    console.error('[companion] vrm load failed', err);
  });

  const clock = new THREE.Clock();
  function loop() {
    if (!started) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (vrm) {
      t += dt;
      if (vrm.expressionManager) {
        const c = t % 4.5;
        vrm.expressionManager.setValue('blink', (c > 4.3 && c < 4.4) ? 1 : 0);
      }
      const chest = vrm.humanoid?.getNormalizedBoneNode('chest');
      if (chest) chest.rotation.x = Math.sin(t * 1.3) * 0.012;
      lookTarget.position.set(mouse.x * 0.5, 1.35 + mouse.y * 0.3, 1.0);
      lookTarget.updateMatrixWorld();
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
