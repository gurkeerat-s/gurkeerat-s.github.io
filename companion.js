// Lazy-loaded VRM "desktop pet" — full-screen, transparent, click-through overlay.
// She stands on the right and does a smooth procedural idle (breathing, weight-shift,
// head sway, arm sway, blink). The page stays usable (pointer-events:none on the stage).
import * as THREE from 'https://esm.sh/three@0.170.0';
import { GLTFLoader } from 'https://esm.sh/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from 'https://esm.sh/@pixiv/three-vrm@3.4.0?deps=three@0.170.0';

const LINES = [
  "hi! i'm gurkeerat's AI companion 🌸",
  "his projects are up there, scroll up 👆",
  "he's after an AI/ML internship 👀",
  "fine-tuned voice models, LLM agents, the works",
  "wanna reach him? his email's at the bottom 💌",
  "that voice agent? he fine-tuned and self-hosts it 🎙️",
  "Saleable's a whole suite of AI agents he shipped 🏠",
  "he ships end-to-end: model → backend → frontend → deployed ⚡",
  "cs · stats · math @ UofT, if you were wondering 🎓",
  "Toronto-based, but happy to work remote too 🇨🇦",
  "honestly he'll out-build the résumé, give him a shot 😤",
  "i'm the AI companion he built for his site 😌",
  "still here? he's genuinely worth a reply 💌",
  "he builds AI agents, so yeah, i'm kind of the demo 😏",
  "type below to ask me anything about him 💬",
];

// Her "brain" is a tiny Cloudflare Worker that proxies to Claude (Haiku), holding the
// API key server-side. See worker/companion-worker.js.
const WORKER = 'https://companion-chat.gurkeeratsappal.workers.dev';

// --- smooth value-noise: organic, non-repeating drift. Beats stacked sines (which read as robotic). ---
function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; }
function noise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; }
function fbm(x) { return noise(x) * 0.6 + noise(x * 2.1 + 5.2) * 0.3 + noise(x * 4.3 + 9.1) * 0.1; }

let started = false;

function injectStyles() {
  if (document.getElementById('cmp-styles')) return;
  const s = document.createElement('style');
  s.id = 'cmp-styles';
  s.textContent = `
  #cmp-stage{position:fixed;inset:0;z-index:45;pointer-events:none;overflow:hidden}
  #cmp-canvas{width:100%;height:100%;display:block}
  #cmp-bubble{position:absolute;left:0;top:0;max-width:300px;max-height:46vh;overflow:auto;
    transform:translate(-100%,-50%);
    background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:10px 13px;
    font-size:13px;line-height:1.4;color:var(--fg);box-shadow:0 10px 30px rgba(0,0,0,.16);
    opacity:0;transition:opacity .35s ease;pointer-events:auto}
  #cmp-bubble a{color:var(--accent);text-decoration:underline;font-weight:600}
  #cmp-close{position:fixed;right:16px;bottom:16px;z-index:46;pointer-events:auto;cursor:pointer;
    background:var(--chip);border:1px solid var(--line);color:var(--fg);border-radius:999px;
    padding:6px 13px;font:inherit;font-size:12px}
  #cmp-close:hover{border-color:var(--accent);color:var(--accent)}
  #cmp-chat{position:fixed;right:16px;bottom:54px;z-index:46;pointer-events:auto;
    width:min(330px,72vw);display:flex;gap:6px}
  #cmp-chat input{flex:1;min-width:0;font:inherit;font-size:13px;padding:9px 14px;border-radius:999px;
    border:1px solid var(--line);background:var(--bg);color:var(--fg);outline:none;
    box-shadow:0 6px 20px rgba(0,0,0,.12)}
  #cmp-chat input::placeholder{color:var(--muted)}
  #cmp-chat input:focus{border-color:var(--accent)}
  #cmp-mic{flex:0 0 auto;width:40px;font-size:15px;border-radius:999px;cursor:pointer;
    border:1px solid var(--line);background:var(--bg);box-shadow:0 6px 20px rgba(0,0,0,.12)}
  #cmp-mic:hover{border-color:var(--accent)}
  #cmp-mic.live{background:#b91c1c;border-color:#b91c1c}
  @media (max-width:700px){ #cmp-bubble{max-width:74vw} }
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
  const chat = document.createElement('div');
  chat.id = 'cmp-chat';
  chat.innerHTML = `<input id="cmp-chat-input" type="text" autocomplete="off" maxlength="160" placeholder="ask me about gurkeerat…" /><button id="cmp-mic" title="talk to me" aria-label="talk">🎤</button>`;
  document.body.appendChild(chat);
  const chatInput = chat.querySelector('#cmp-chat-input');
  const micBtn = chat.querySelector('#cmp-mic');

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

  let HOME_X = 1.0;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (w < 700) {                       // narrow / portrait: smaller + nudged right so her speech bubble has room on the left
      HOME_X = 0.55;
      camera.position.set(0, 1.5, 6.8);   // aim higher -> she drops lower in frame, standing near the chat box
      camera.lookAt(0, 1.5, 0);
    } else {                             // desktop: docked to the right
      HOME_X = 1.0;
      camera.position.set(0, 0.90, 3.5);
      camera.lookAt(0, 0.90, 0);
    }
    camera.updateProjectionMatrix();
  }
  resize(); window.addEventListener('resize', resize);

  let vrm = null, baseY = 0, t = 0;
  let blinkTimer = 2 + Math.random() * 2, blinkPhase = 0;
  let bubbleOn = false, lineTimer = 0.6, lineI = 0, chatHold = 0;
  let speaking = false, talk = 0, busy = false;
  // idle "look-around" beats + talking hand-gesture pulses
  let beatTimer = 1.2, glance = { x: 0, y: 0, z: 0 }, glanceTarget = { x: 0, y: 0, z: 0 };
  let handTimer = 1.0, handSide = 1, handAmt = 0, handTarget = 0;
  const B = (n) => vrm?.humanoid?.getNormalizedBoneNode(n);

  // show text in the bubble and hold it (pausing the auto-cycling idle lines)
  function showBubble(text) {
    bubble.textContent = text;
    bubble.style.opacity = '1';
    bubbleOn = true; chatHold = 14; lineTimer = 14;
  }

  // --- her voice (browser TTS) — `speaking` drives lip-sync + gestures in the loop ---
  let voice = null;
  function pickVoice() {
    const vs = speechSynthesis.getVoices();
    voice = vs.find(v => /female|samantha|karen|moira|tessa|zira|aria|jenny|google us english/i.test(v.name) && /en/i.test(v.lang))
         || vs.find(v => /en-US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || vs[0] || null;
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  let audioCtx = null, analyser = null, mouthLevel = 0, realAudio = false, currentSrc = null;
  function speakBrowser(text) {
    return new Promise(res => {
      if (!('speechSynthesis' in window)) { res(); return; }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.rate = 1.03; u.pitch = 1.1;
      u.onstart = () => { speaking = true; };
      u.onend = () => { speaking = false; res(); };
      u.onerror = () => { speaking = false; res(); };
      speechSynthesis.speak(u);
    });
  }
  function playAudio(buf) {
    return new Promise(async (res) => {
      try {
        if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); analyser = audioCtx.createAnalyser(); analyser.fftSize = 256; }
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        const audioBuf = await audioCtx.decodeAudioData(buf);
        const src = audioCtx.createBufferSource(); src.buffer = audioBuf; currentSrc = src;
        src.connect(analyser); analyser.connect(audioCtx.destination);
        const data = new Uint8Array(analyser.frequencyBinCount);
        realAudio = true; speaking = true;
        let raf;
        const tick = () => { analyser.getByteFrequencyData(data); let s = 0; for (let i = 2; i < 26; i++) s += data[i]; mouthLevel = Math.min(1, (s / 24) / 135); raf = requestAnimationFrame(tick); };
        tick();
        src.onended = () => { speaking = false; realAudio = false; mouthLevel = 0; currentSrc = null; cancelAnimationFrame(raf); res(); };
        src.start();
      } catch (e) { realAudio = false; res('fail'); }
    });
  }
  // try the ElevenLabs voice via the worker; fall back to the browser voice if it fails
  async function speak(text) {
    try {
      const r = await fetch(WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tts: text }) });
      if (!r.ok) throw new Error('tts ' + r.status);
      const buf = await r.arrayBuffer();
      if (await playAudio(buf) === 'fail') await speakBrowser(text);
    } catch (e) {
      await speakBrowser(text);
    }
  }

  // --- conversation: real Claude via the worker ---
  const history = [];
  async function askClaude(text) {
    history.push({ role: 'user', content: text });
    let reply = "hmm, i glitched for a sec — try me again?";
    try {
      const r = await fetch(WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-10) }) });
      const d = await r.json();
      if (d.reply) reply = d.reply;
    } catch (e) { /* keep fallback */ }
    history.push({ role: 'assistant', content: reply });
    return reply;
  }
  async function handleUser(text) {
    if (busy) return;
    busy = true;
    showBubble('…');
    const reply = await askClaude(text);
    showBubble(reply);
    await speak(reply);
    busy = false;
  }
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = chatInput.value.trim();
      if (!q) return;
      chatInput.value = '';
      handleUser(q);
    }
  });

  // --- voice input: push-to-talk ---
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recog = null, listening = false;
  micBtn.addEventListener('click', () => {
    if (!SR) { showBubble("voice input works best in chrome 😅 just type to me!"); return; }
    if (listening) { try { recog.stop(); } catch (e) {} return; }
    speechSynthesis.cancel();
    recog = new SR(); recog.lang = 'en-US'; recog.interimResults = false; recog.continuous = false; recog.maxAlternatives = 1;
    recog.onstart = () => { listening = true; micBtn.classList.add('live'); showBubble('listening… 🎙️'); };
    recog.onresult = (e) => { const txt = (e.results[0][0].transcript || '').trim(); if (txt) handleUser(txt); };
    recog.onerror = (ev) => { if (ev.error === 'not-allowed') showBubble('mic blocked — type to me instead!'); };
    recog.onend = () => { listening = false; micBtn.classList.remove('live'); };
    try { recog.start(); } catch (e) {}
  });

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
      const breathe = Math.sin(t * 1.5);
      const spine = B('spine'), chest = B('chest') || B('upperChest'), hips = B('hips');
      const neck = B('neck'), head = B('head');
      const lUA = B('leftUpperArm'), rUA = B('rightUpperArm');
      const lLA = B('leftLowerArm'), rLA = B('rightLowerArm');

      // --- organic idle drift: noise-driven weight-shift + breathing (not metronome sines) ---
      const swayX = fbm(t * 0.18), swayZ = fbm(t * 0.15 + 13.0);
      if (hips) { hips.rotation.z = swayX * 0.05; hips.rotation.y = swayZ * 0.04; }
      if (spine) { spine.rotation.x = breathe * 0.04 - swayX * 0.02; spine.rotation.z = -swayX * 0.045; }
      if (chest) chest.rotation.x = breathe * 0.025;

      // --- look-around "beats": ease the gaze toward a target, repick it every few seconds ---
      beatTimer -= dt;
      if (beatTimer <= 0) {
        glanceTarget.y = (Math.random() * 2 - 1) * 0.28;
        glanceTarget.x = (Math.random() * 2 - 1) * 0.10;
        glanceTarget.z = (Math.random() * 2 - 1) * 0.06;
        beatTimer = 2.4 + Math.random() * 3.4;
      }
      const ge = Math.min(1, dt * 1.8);
      glance.x += (glanceTarget.x - glance.x) * ge;
      glance.y += (glanceTarget.y - glance.y) * ge;
      glance.z += (glanceTarget.z - glance.z) * ge;
      if (neck) neck.rotation.y = glance.y * 0.35;
      if (head) {
        head.rotation.y = glance.y * 0.65 + fbm(t * 0.4 + 2) * 0.05;
        head.rotation.x = glance.x + breathe * 0.015 + fbm(t * 0.5 + 7) * 0.04;
        head.rotation.z = glance.z + fbm(t * 0.3 + 4) * 0.03;
      }

      // --- arms rest at sides (known-good z), with a touch of noise life ---
      if (lUA) { lUA.rotation.z = 1.42 + fbm(t * 0.4) * 0.04; lUA.rotation.x = fbm(t * 0.45 + 3) * 0.04; }
      if (rUA) { rUA.rotation.z = -1.42 - fbm(t * 0.4 + 8) * 0.04; rUA.rotation.x = fbm(t * 0.45 + 5) * 0.04; }
      if (lLA) lLA.rotation.x = -0.16 + fbm(t * 0.5) * 0.04;
      if (rLA) rLA.rotation.x = -0.16 + fbm(t * 0.5 + 6) * 0.04;

      // --- talking layer: head comes alive + hand gestures fire in pulses (alternating sides) ---
      talk += ((speaking ? 1 : 0) - talk) * Math.min(1, dt * 5);
      if (talk > 0.001) {
        const emph = realAudio ? mouthLevel : (Math.sin(t * 9) * 0.5 + 0.5); // nod harder on loud syllables
        if (head) {
          head.rotation.x += (Math.sin(t * 3.1) * 0.05 + emph * 0.06) * talk;
          head.rotation.y += Math.sin(t * 1.9) * 0.09 * talk;
          head.rotation.z += Math.sin(t * 2.5) * 0.03 * talk;
        }
        if (spine) spine.rotation.x += Math.sin(t * 2.0) * 0.02 * talk;

        handTimer -= dt;
        if (handTimer <= 0 && handTarget === 0 && handAmt < 0.05) { // fire a fresh gesture
          handTarget = 1; handSide = -handSide; handTimer = 1.3 + Math.random() * 1.6;
        }
        handAmt += (handTarget - handAmt) * Math.min(1, dt * 4.5);
        if (handTarget === 1 && handAmt > 0.82) handTarget = 0;       // raise, then settle back down
        const g = handAmt * talk;
        const UA = handSide < 0 ? lUA : rUA, LA = handSide < 0 ? lLA : rLA;
        if (UA) UA.rotation.x += -0.5 * g;   // lift upper arm forward
        if (LA) LA.rotation.x += -0.85 * g;  // bend forearm up — a gesticulation
        const oUA = handSide < 0 ? rUA : lUA, oLA = handSide < 0 ? rLA : lLA; // light life in the other arm
        if (oUA) oUA.rotation.x += -0.12 * g;
        if (oLA) oLA.rotation.x += -0.3 * g;
      }

      // lip-sync: drive the mouth from the real audio waveform when available, else oscillate
      const mouth = speaking
        ? (realAudio ? Math.min(0.9, 0.08 + mouthLevel * 1.15) : (0.16 + 0.22 * (Math.sin(t * 13) * 0.5 + 0.5)))
        : 0;
      vrm.expressionManager?.setValue('aa', mouth);
      vrm.expressionManager?.setValue('happy', 0.16 * talk);

      vrm.scene.position.y = breathe * 0.02;
      vrm.scene.position.x = HOME_X;
      vrm.scene.rotation.y = baseY;
      shadow.position.x = HOME_X;

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

      // speech bubble: auto-cycle lines, unless a chat reply is being held
      lineTimer -= dt;
      if (chatHold > 0) chatHold -= dt;
      if (lineTimer <= 0 && chatHold <= 0) {
        if (bubbleOn) { bubble.style.opacity = '0'; bubbleOn = false; lineTimer = 4; }
        else { bubble.textContent = LINES[lineI++ % LINES.length]; bubble.style.opacity = '1'; bubbleOn = true; lineTimer = 5.5; }
      }
      const hn = B('head');
      if (hn) {
        const p = new THREE.Vector3(); hn.getWorldPosition(p); p.y += 0.12; p.project(camera);
        bubble.style.left = ((p.x * 0.5 + 0.5) * window.innerWidth - 16) + 'px';  // sit to her left
        bubble.style.top = ((-p.y * 0.5 + 0.5) * window.innerHeight) + 'px';
      }
    }
    renderer.render(scene, camera);
  }
  loop();

  close.onclick = () => {
    started = false;
    try { speechSynthesis.cancel(); } catch (e) {}
    if (currentSrc) { try { currentSrc.stop(); } catch (e) {} }
    if (recog && listening) { try { recog.stop(); } catch (e) {} }
    document.documentElement.classList.remove('cmp-active');
    window.removeEventListener('resize', resize);
    renderer.dispose();
    stage.remove(); close.remove(); chat.remove();
    const summon = document.getElementById('summon-btn');
    if (summon) summon.style.display = '';
  };
}
