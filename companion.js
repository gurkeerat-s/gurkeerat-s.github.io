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

// Rule-based "brain" — matches the visitor's question to a canned answer built from
// gurkeerat's real info. First matching rule wins, so order specific -> general.
const KB = [
  { re: /\b(hi+|hey+|hello|yo|sup|howdy|good (morning|evening|afternoon))\b/, a: "hey! 👋 i'm gurkeerat's assistant. ask me about his projects, his experience, his skills, or how to reach him!" },
  { re: /(who|what)\s*('?s| is| are)?\s*(you|u)\b|your name|you a bot|are you (ai|real|human)/, a: "i'm gurkeerat's AI companion 😌 i know all about his work, so ask away!" },
  { re: /plinky|tip\s?jar|tipping|crypto|usdc|\bwallet|non.?custod/, a: "Plinky's his non-custodial payments app 💸 fans tip creators in USDC straight to their own wallet — no middleman, none of the scary crypto jargon. live at <a href='https://plinky.to' target='_blank' rel='noopener'>plinky.to</a>!" },
  { re: /saleable|condoville|real.?estate|brokerage|\bmls\b|listing/, a: "Saleable's the real-estate AI suite he built at Condoville 🏠 a phone voice agent, a chatbot, an OREA contract-review copilot + a form generator over MLS data. see <a href='https://saleablere.com' target='_blank' rel='noopener'>saleablere.com</a>." },
  { re: /voice agent|voice ai|orpheus|\btts\b|text.?to.?speech|speech|self.?host/, a: "his self-hosted voice agent 🎙️ real-time + full-duplex, with a TTS voice he fine-tuned himself (Orpheus 3B + vLLM, one GPU, no external APIs). code on <a href='https://github.com/gurkeerat-s/voice-agent' target='_blank' rel='noopener'>github</a>." },
  { re: /chattelbot|receptionist|dealership/, a: "ChattelBot 📞 an AI voice + chat receptionist he shipped to 5+ businesses — LiveKit + GPT + RAG. live at <a href='https://www.chattelbot.com' target='_blank' rel='noopener'>chattelbot.com</a>." },
  { re: /outlier|scale ai|rlhf|red.?team|model eval|evaluat/, a: "at Outlier AI (Scale AI) he was a prompt engineer + model evaluator 🧪 RLHF preference data, red-teaming, gold-standard answers — 200+ LLM outputs a week." },
  { re: /urai|lead gen|lead generation|prospect/, a: "at Urai he built custom AI systems to source + qualify leads 🎯 industry-targeted prospect lists at scale." },
  { re: /project|portfolio|\bbuilt\b|\bbuild\b|\bmade\b|ship|what.*(does|do|work)|his work/, a: "he's shipped a bunch 🚀 Plinky (crypto payments), Saleable (real-estate AI suite), a self-hosted voice agent, + ChattelBot. wanna hear about one? just name it!" },
  { re: /experience|\bjobs?\b|worked|companies|employ|career/, a: "real roles: Saleable / Condoville (AI dev), Outlier AI / Scale (model eval + RLHF), ChattelBot (full-stack AI), and Urai (AI lead gen) 💼 scroll up for the details!" },
  { re: /skill|tech|stack|language|tools|framework|programming|coding/, a: "he works in Python, TypeScript, Java, R, SQL 🛠️ plus LangChain, RAG, vector DBs, LiveKit, model fine-tuning / vLLM, and Next.js/React. ML + full-stack both." },
  { re: /contact|reach|e.?mail|get in touch|message|connect|\bdm\b|talk to him|how.*(contact|reach)/, a: "easiest is email: <a href='mailto:gurkeeratsappal@gmail.com'>gurkeeratsappal@gmail.com</a> 💌 he's also on <a href='https://www.linkedin.com/in/gurkeerat-sappal' target='_blank' rel='noopener'>linkedin</a> + <a href='https://github.com/gurkeerat-s' target='_blank' rel='noopener'>github</a>." },
  { re: /intern|hiring|hire|available|looking|open to|co.?op|opportunit|\broles?\b/, a: "yep! he's after an AI/ML internship or co-op for fall 2026 👀 Toronto-based but down for remote. email him: <a href='mailto:gurkeeratsappal@gmail.com'>gurkeeratsappal@gmail.com</a>!" },
  { re: /resume|\bcv\b/, a: "his resume's not on the site, but email him (<a href='mailto:gurkeeratsappal@gmail.com'>gurkeeratsappal@gmail.com</a>) and he'll send it right over 📄" },
  { re: /school|study|studi|education|degree|major|uoft|university|college|student|\bgpa\b/, a: "he studies CS + Statistics + Math at the University of Toronto (Mississauga) 🎓 graduating 2027, Dean's List." },
  { re: /where|location|based|\blive\b|remote|toronto|canada|ontario/, a: "he's in the Toronto area 🇨🇦 (Brampton / Mississauga) and totally open to remote." },
  { re: /thank|thx|\bty\b|appreciate/, a: "anytime! 💛" },
  { re: /bye|goodbye|see ya|\blater\b|\bcya\b|peace out/, a: "see ya! 👋 don't forget to peek at his projects ✨" },
  { re: /this site|website|made you|built you|how.*made|who made/, a: "gurkeerat built this whole site — and me! — himself 😎 he's into AI + a bit of 3D." },
  { re: /love you|marry|\bcute\b|pretty|\bhot\b|girlfriend|\bgf\b|\bdate\b/, a: "aw 😳 i'm just here to chat about gurkeerat's work, haha. ask me something about him!" },
];
function answer(q) {
  const s = (q || '').toLowerCase().trim();
  if (!s) return null;
  for (const k of KB) if (k.re.test(s)) return k.a;
  return "hmm, i mostly know about gurkeerat 😅 try asking about his projects, his experience, his skills, or how to reach him!";
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
  #cmp-chat{position:fixed;right:16px;bottom:54px;z-index:46;pointer-events:auto;width:min(330px,72vw)}
  #cmp-chat input{width:100%;font:inherit;font-size:13px;padding:9px 14px;border-radius:999px;
    border:1px solid var(--line);background:var(--bg);color:var(--fg);outline:none;
    box-shadow:0 6px 20px rgba(0,0,0,.12)}
  #cmp-chat input::placeholder{color:var(--muted)}
  #cmp-chat input:focus{border-color:var(--accent)}
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
  chat.innerHTML = `<input id="cmp-chat-input" type="text" autocomplete="off" maxlength="120" placeholder="ask me about gurkeerat…" />`;
  document.body.appendChild(chat);
  const chatInput = chat.querySelector('#cmp-chat-input');

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

  // show a reply (or any HTML) in the bubble and hold it, pausing the auto-cycling lines
  function say(html) {
    bubble.innerHTML = html;
    bubble.style.opacity = '1';
    bubbleOn = true; chatHold = 9; lineTimer = 9;
  }
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = chatInput.value.trim();
      if (!q) return;
      chatInput.value = '';
      say(answer(q));
    }
  });
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
    document.documentElement.classList.remove('cmp-active');
    window.removeEventListener('resize', resize);
    renderer.dispose();
    stage.remove(); close.remove(); chat.remove();
    const summon = document.getElementById('summon-btn');
    if (summon) summon.style.display = '';
  };
}
