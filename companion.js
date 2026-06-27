// Lazy-loaded VRM "desktop pet" — full-screen, transparent, click-through overlay.
// She stands on the right and plays real VRMA idle animations (Relax / Thinking /
// LookAround), crossfading between them. Procedural breathing is the fallback if the
// animation files fail to load. The page stays usable (pointer-events:none on the stage).
import * as THREE from 'https://esm.sh/three@0.170.0';
import { GLTFLoader } from 'https://esm.sh/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from 'https://esm.sh/@pixiv/three-vrm@3.4.0?deps=three@0.170.0';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from 'https://esm.sh/@pixiv/three-vrm-animation@3.4.0?deps=three@0.170.0';

const LINES = [
  "hi! i'm gurkeerat's lil AI companion 🌸",
  "his projects are up there — scroll up 👆",
  "he's hunting an AI/ML internship 👀",
  "fine-tuned voice models, LLM agents… the works",
  "wanna reach him? his email's at the bottom 💌",
];
const ANIMS = ['Relax', 'Thinking', 'LookAround'];

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
    font-size:10px;color:var(--muted);opacity:.6;max-width:60vw}
  #cmp-credit a{color:inherit}
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
  const credit = document.createElement('div');
  credit.id = 'cmp-credit';
  credit.innerHTML = 'avatar メカクレ少女 · ギリギリチャンネル (VRoid Hub) · animations tk256ailab (MIT)';
  document.body.appendChild(close);
  document.body.appendChild(credit);

  const canvas = stage.querySelector('#cmp-canvas');
  const bubble = stage.querySelector('#cmp-bubble');

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.0, 3.0);
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

  let vrm = null, baseY = 0, t = 0;
  let blinkTimer = 2 + Math.random() * 2, blinkPhase = 0;
  let bubbleOn = false, lineTimer = 0.6, lineI = 0;
  let mixer = null, actions = [], cur = 0, animTimer = 8;
  const HOME_X = 0.85;
  const B = (n) => vrm.humanoid?.getNormalizedBoneNode(n);

  const loader = new GLTFLoader();
  loader.register((p) => new VRMLoaderPlugin(p));
  loader.load('avatar.vrm', async (gltf) => {
    vrm = gltf.userData.vrm;
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(vrm);
    baseY = vrm.scene.rotation.y;
    scene.add(vrm.scene);

    // load + wire the VRMA idle animations
    try {
      const aLoader = new GLTFLoader();
      aLoader.register((p) => new VRMAnimationLoaderPlugin(p));
      mixer = new THREE.AnimationMixer(vrm.scene);
      const clips = await Promise.all(ANIMS.map(async (name) => {
        try {
          const g = await aLoader.loadAsync('vrma/' + name + '.vrma');
          const va = g.userData.vrmAnimations && g.userData.vrmAnimations[0];
          return va ? createVRMAnimationClip(va, vrm) : null;
        } catch (e) { console.warn('[companion] vrma', name, e); return null; }
      }));
      actions = clips.filter(Boolean).map((c) => {
        const a = mixer.clipAction(c); a.setLoop(THREE.LoopRepeat); return a;
      });
      if (actions.length) { actions[0].play(); cur = 0; animTimer = 8; }
      else { mixer = null; console.warn('[companion] no animations loaded, using procedural idle'); }
    } catch (e) { mixer = null; console.warn('[companion] animation setup failed', e); }
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
      if (mixer && actions.length) {
        mixer.update(dt);
        // crossfade to the next idle gesture every ~8.5s
        animTimer -= dt;
        if (actions.length > 1 && animTimer <= 0) {
          const nxt = (cur + 1) % actions.length;
          actions[nxt].reset().play();
          actions[cur].crossFadeTo(actions[nxt], 0.9, false);
          cur = nxt; animTimer = 8.5;
        }
      } else {
        // procedural fallback so she never freezes in a T-pose
        const breathe = Math.sin(t * 1.5);
        const sp = B('spine'); if (sp) { sp.rotation.x = breathe * 0.04; sp.rotation.z = Math.sin(t * 0.6) * 0.03; }
        const hp = B('hips'); if (hp) hp.rotation.z = Math.sin(t * 0.7) * 0.04;
        const hd = B('head'); if (hd) { hd.rotation.y = Math.sin(t * 0.55) * 0.16; hd.rotation.x = Math.sin(t * 0.42) * 0.06; }
        const lUA = B('leftUpperArm'), rUA = B('rightUpperArm');
        if (lUA) { lUA.rotation.z = 1.2; lUA.rotation.x = Math.sin(t * 0.9) * 0.1; }
        if (rUA) { rUA.rotation.z = -1.2; rUA.rotation.x = Math.sin(t * 0.9 + 0.5) * 0.1; }
        vrm.scene.position.y = breathe * 0.018;
      }

      // keep her docked on the right + facing the viewer
      vrm.scene.position.x = HOME_X;
      vrm.scene.rotation.y = baseY;

      // procedural blink (the clips don't blink)
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
    stage.remove(); close.remove(); credit.remove();
    const summon = document.getElementById('summon-btn');
    if (summon) summon.style.display = '';
  };
}
