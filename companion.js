// Lazy-loaded VRM "desktop pet" — full-screen, transparent, click-through overlay.
// She stands on the right and does a smooth procedural idle (breathing, weight-shift,
// head sway, arm sway, blink). The page stays usable (pointer-events:none on the stage).
import * as THREE from 'https://esm.sh/three@0.170.0';
import { GLTFLoader } from 'https://esm.sh/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'https://esm.sh/three@0.170.0/examples/jsm/loaders/FBXLoader.js';
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

// Mixamo mocap animations (real, fluid) retargeted onto the VRM skeleton. Hosted on jsdelivr (CORS-open).
const MIXAMO_BASE = 'https://cdn.jsdelivr.net/gh/wass08/r3f-virtual-girlfriend-frontend@main/public/animations/';
const IDLE_CLIP = 'Standing%20Idle.fbx';
const TALK_CLIPS = ['Talking_0.fbx', 'Talking_1.fbx', 'Talking_2.fbx'];

// Mixamo rig bone -> VRM humanoid bone. Keys are prefix-less; the loader strips any "mixamorig"/"mixamorig:"
// prefix before lookup, so this works whether or not the FBX kept Mixamo's bone-name prefix.
const mixamoVRMRigMap = {
  Hips: 'hips', Spine: 'spine', Spine1: 'chest', Spine2: 'upperChest', Neck: 'neck', Head: 'head',
  LeftShoulder: 'leftShoulder', LeftArm: 'leftUpperArm', LeftForeArm: 'leftLowerArm', LeftHand: 'leftHand',
  LeftHandThumb1: 'leftThumbMetacarpal', LeftHandThumb2: 'leftThumbProximal', LeftHandThumb3: 'leftThumbDistal',
  LeftHandIndex1: 'leftIndexProximal', LeftHandIndex2: 'leftIndexIntermediate', LeftHandIndex3: 'leftIndexDistal',
  LeftHandMiddle1: 'leftMiddleProximal', LeftHandMiddle2: 'leftMiddleIntermediate', LeftHandMiddle3: 'leftMiddleDistal',
  LeftHandRing1: 'leftRingProximal', LeftHandRing2: 'leftRingIntermediate', LeftHandRing3: 'leftRingDistal',
  LeftHandPinky1: 'leftLittleProximal', LeftHandPinky2: 'leftLittleIntermediate', LeftHandPinky3: 'leftLittleDistal',
  RightShoulder: 'rightShoulder', RightArm: 'rightUpperArm', RightForeArm: 'rightLowerArm', RightHand: 'rightHand',
  RightHandPinky1: 'rightLittleProximal', RightHandPinky2: 'rightLittleIntermediate', RightHandPinky3: 'rightLittleDistal',
  RightHandRing1: 'rightRingProximal', RightHandRing2: 'rightRingIntermediate', RightHandRing3: 'rightRingDistal',
  RightHandMiddle1: 'rightMiddleProximal', RightHandMiddle2: 'rightMiddleIntermediate', RightHandMiddle3: 'rightMiddleDistal',
  RightHandIndex1: 'rightIndexProximal', RightHandIndex2: 'rightIndexIntermediate', RightHandIndex3: 'rightIndexDistal',
  RightHandThumb1: 'rightThumbMetacarpal', RightHandThumb2: 'rightThumbProximal', RightHandThumb3: 'rightThumbDistal',
  LeftUpLeg: 'leftUpperLeg', LeftLeg: 'leftLowerLeg', LeftFoot: 'leftFoot', LeftToeBase: 'leftToes',
  RightUpLeg: 'rightUpperLeg', RightLeg: 'rightLowerLeg', RightFoot: 'rightFoot', RightToeBase: 'rightToes',
};
const stripRig = (n) => n.replace(/^mixamorig:?/i, '');

// Adapted from pixiv/three-vrm's official loadMixamoAnimation example: retarget a Mixamo FBX clip to a VRM.
function loadMixamoAnimation(url, vrm) {
  const loader = new FBXLoader();
  return loader.loadAsync(url).then((asset) => {
    const clip = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com');
    const tracks = [];
    const restRotationInverse = new THREE.Quaternion();
    const parentRestWorldRotation = new THREE.Quaternion();
    const _quatA = new THREE.Quaternion();
    const hipsNode = asset.getObjectByName('Hips') || asset.getObjectByName('mixamorigHips');
    const motionHipsHeight = hipsNode.position.y;
    const vrmHipsHeight = vrm.humanoid?.normalizedRestPose.hips.position[1];
    const hipsPositionScale = vrmHipsHeight / motionHipsHeight;
    clip.tracks.forEach((track) => {
      const trackSplitted = track.name.split('.');
      const mixamoRigName = trackSplitted[0];
      const vrmBoneName = mixamoVRMRigMap[stripRig(mixamoRigName)];
      const vrmNodeName = vrm.humanoid?.getNormalizedBoneNode(vrmBoneName)?.name;
      const mixamoRigNode = asset.getObjectByName(mixamoRigName);
      if (vrmNodeName != null) {
        const propertyName = trackSplitted[1];
        mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
        mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation);
        if (track instanceof THREE.QuaternionKeyframeTrack) {
          for (let i = 0; i < track.values.length; i += 4) {
            const flatQuaternion = track.values.slice(i, i + 4);
            _quatA.fromArray(flatQuaternion);
            _quatA.premultiply(parentRestWorldRotation).multiply(restRotationInverse);
            _quatA.toArray(flatQuaternion);
            flatQuaternion.forEach((v, index) => { track.values[index + i] = v; });
          }
          tracks.push(new THREE.QuaternionKeyframeTrack(
            `${vrmNodeName}.${propertyName}`, track.times,
            track.values.map((v, i) => (vrm.meta?.metaVersion === '0' && i % 2 === 0 ? -v : v)),
          ));
        }
        // Position (VectorKeyframeTrack) tracks are intentionally skipped: the retargeted hips translation
        // flings her off-screen on these files (unreliable hips-height scale). She stays planted at rest
        // height; the camera framing + contact shadow keep her looking grounded.
      }
    });
    return new THREE.AnimationClip('vrmAnimation', clip.duration, tracks);
  });
}

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
    } else {                             // desktop: docked to the right, aimed lower so the ground + shadow show under her feet (no floating)
      HOME_X = 1.0;
      camera.position.set(0, 0.82, 3.6);
      camera.lookAt(0, 0.72, 0);
    }
    camera.updateProjectionMatrix();
  }
  resize(); window.addEventListener('resize', resize);

  let vrm = null, baseY = 0, t = 0;
  let blinkTimer = 2 + Math.random() * 2, blinkPhase = 0;
  let bubbleOn = false, lineTimer = 0.6, lineI = 0, chatHold = 0;
  let speaking = false, talk = 0, busy = false;
  // mocap playback: AnimationMixer crossfading a looping idle clip <-> talking clips
  let mixer = null, idleAction = null, talkActions = [], currentAction = null, talkSwitchT = 0;
  // living eyes: a lookAt target that darts around, mostly toward the viewer
  let eyeTarget = null, eyeTimer = 0.5;
  const eyeGoal = new THREE.Vector3(0, 1.3, 3);
  // idle weight-shift (eases foot-to-foot) + a base yaw so she angles toward the viewer/content on the left
  let weightTimer = 1.5, weightSide = 1, weightPos = 0;
  const FACE_YAW = 0.42;
  function fadeTo(action, dur = 0.45) {
    if (!action || action === currentAction) return;
    if (currentAction) currentAction.fadeOut(dur);
    action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(dur).play();
    currentAction = action;
  }
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
    let reply = "hmm, i glitched for a sec, try me again?";
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
    recog.onerror = (ev) => { if (ev.error === 'not-allowed') showBubble('mic blocked, type to me instead!'); };
    recog.onend = () => { listening = false; micBtn.classList.remove('live'); };
    try { recog.start(); } catch (e) {}
  });

  // soft contact shadow so she's grounded, not floating
  const shCanvas = document.createElement('canvas'); shCanvas.width = shCanvas.height = 128;
  const shCtx = shCanvas.getContext('2d');
  const grd = shCtx.createRadialGradient(64, 64, 3, 64, 64, 60);
  grd.addColorStop(0, 'rgba(0,0,0,0.45)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  shCtx.fillStyle = grd; shCtx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.62),
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

    // give her living eyes: aim VRM lookAt at a target we drift around (mostly toward the viewer)
    if (vrm.lookAt) { eyeTarget = new THREE.Object3D(); eyeTarget.position.set(0, 1.3, 3); scene.add(eyeTarget); vrm.lookAt.target = eyeTarget; }

    // load the mocap clips and start the idle loop; talking clips stand by for crossfade
    mixer = new THREE.AnimationMixer(vrm.scene);
    loadMixamoAnimation(MIXAMO_BASE + IDLE_CLIP, vrm)
      .then((clip) => { idleAction = mixer.clipAction(clip); fadeTo(idleAction, 0.01); })
      .catch((err) => console.error('[companion] idle clip failed', err));
    TALK_CLIPS.forEach((f) => {
      loadMixamoAnimation(MIXAMO_BASE + f, vrm)
        .then((clip) => { talkActions.push(mixer.clipAction(clip)); })
        .catch((err) => console.error('[companion] talk clip failed', f, err));
    });
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

      // --- body: real Mixamo mocap via the mixer. Crossfade idle <-> talking; rotate talking clips for variety ---
      if (mixer) {
        mixer.update(dt);
        if (speaking && talkActions.length) {
          talkSwitchT -= dt;
          if (!talkActions.includes(currentAction) || talkSwitchT <= 0) {
            let next = talkActions[(Math.random() * talkActions.length) | 0];
            if (next === currentAction) next = talkActions[(talkActions.indexOf(next) + 1) % talkActions.length];
            fadeTo(next);
            talkSwitchT = 3 + Math.random() * 3;
          }
        } else if (!speaking && idleAction) {
          fadeTo(idleAction);
        }
      }
      talk += ((speaking ? 1 : 0) - talk) * Math.min(1, dt * 5);

      // --- keep her facing the viewer: damp the torso's yaw twist from the clip. The idle + talk clips
      //     both stand her at a 3/4 angle; flattening the yaw rotates her back toward front (the viewer). ---
      {
        const damp = 0.3;  // keep only ~30% of the clip's turn, so she faces forward but isn't rigid
        const hipsT = B('hips'), spineT = B('spine'), chestT = B('chest') || B('upperChest'), neckT = B('neck');
        if (hipsT) hipsT.rotation.y *= damp;
        if (spineT) spineT.rotation.y *= damp;
        if (chestT) chestT.rotation.y *= damp;
        if (neckT) neckT.rotation.y *= damp;
      }

      // --- idle weight-shift: actually shift weight foot-to-foot (ease to one side, hold, switch) ---
      const idleAmt = 1 - Math.min(1, talk * 2);
      if (idleAmt > 0.01) {
        weightTimer -= dt;
        if (weightTimer <= 0) { weightSide = -weightSide; weightTimer = 2.4 + Math.random() * 2.2; }
        weightPos += (weightSide - weightPos) * Math.min(1, dt * 1.4);   // ease toward the planted foot
        const bob = Math.sin(t * 1.6) * 0.5 + 0.5;                        // gentle breathing overlay
        const hips = B('hips'), spine = B('spine'), chest = B('chest') || B('upperChest'), head = B('head');
        if (hips) { hips.rotation.z += weightPos * 0.14 * idleAmt; hips.rotation.x += bob * 0.015 * idleAmt; }
        if (spine) spine.rotation.z += -weightPos * 0.07 * idleAmt;
        if (chest) chest.rotation.z += -weightPos * 0.04 * idleAmt;
        if (head) { head.rotation.z += -weightPos * 0.05 * idleAmt; head.rotation.y += weightPos * 0.08 * idleAmt; }
      }

      // --- eyes: drift the lookAt target around, mostly toward the viewer, with occasional glances ---
      if (eyeTarget) {
        eyeTimer -= dt;
        if (eyeTimer <= 0) {
          const glanceAway = Math.random() < 0.3;
          eyeGoal.set(
            (Math.random() * 2 - 1) * (glanceAway ? 2.4 : 1.0),
            1.2 + (Math.random() * 2 - 1) * (glanceAway ? 0.5 : 0.25),
            3,
          );
          eyeTimer = 0.8 + Math.random() * 2.2;
        }
        eyeTarget.position.lerp(eyeGoal, Math.min(1, dt * 3));
      }

      // --- expressions ride on top of the mocap (separate from the skeleton, so no conflict) ---
      // gentle near-constant smile that brightens when talking
      const smile = 0.1 + 0.05 * (Math.sin(t * 0.5) * 0.5 + 0.5) + 0.16 * talk;
      vrm.expressionManager?.setValue('happy', Math.min(0.4, smile));
      // audio-driven lip-sync (falls back to an oscillation when there's no real audio level)
      const mouth = speaking
        ? (realAudio ? Math.min(0.9, 0.08 + mouthLevel * 1.15) : (0.16 + 0.22 * (Math.sin(t * 13) * 0.5 + 0.5)))
        : 0;
      vrm.expressionManager?.setValue('aa', mouth);

      vrm.scene.position.x = HOME_X;
      vrm.scene.position.y = 0;
      vrm.scene.rotation.y = baseY + FACE_YAW;   // angle her toward the viewer/content on the left
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
