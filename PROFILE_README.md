<!-- This is your GitHub PROFILE README.
     To use it: create a new repo named EXACTLY your GitHub username (e.g. github.com/gurkeerat-s/gurkeerat-s),
     add this as README.md, and it'll render on your profile page.
     Replace YOUR_GITHUB / YOUR_LINKEDIN / the portfolio URL below first. -->

# Hi, I'm Gurkeerat 👋

**CS · Statistics · Math @ the University of Toronto.** I build production AI systems — fine-tuning and serving models, and wiring up real-time LLM agents. I work end-to-end: model → backend → frontend → deployed.

🔭 **Currently:** looking for an **AI/ML internship / co-op** where I can plug in and ship fast.

---

### What I've built

**🎙️ Self-Hosted Voice Agent** — a full-duplex, real-time voice agent with a *custom fine-tuned* TTS voice, running on a single GPU with no external inference APIs.
- LoRA fine-tuned **Orpheus 3B** TTS (+ a parallel Sesame CSM-1B) on a self-collected 850-clip dataset; audio tokenized via the SNAC 24kHz codec
- Served with **vLLM**; real-time loop with Silero VAD, faster-whisper streaming STT, barge-in, and LLM KV-cache warming
- *Stack: PyTorch · PEFT/LoRA · vLLM · faster-whisper · FastAPI · RunPod GPU*

**🏠 Saleable — Real-Estate AI Suite** — four AI apps for a brokerage over a shared MLS data layer.
- **Voice agent** on LiveKit (real inbound calls, SIP, function-calling for MLS search + booking + Twilio SMS)
- **Contract copilot** over Ontario OREA PDFs with source citations + compliance guardrails
- **Form generator** for 10+ OREA forms, and a **RAG** chatbot for buyers/sellers
- *Stack: FastAPI · LiveKit Agents · Claude/Grok · ChromaDB · Twilio · pypdf*

---

🌐 **Portfolio:** YOUR_PORTFOLIO_URL *(add after you deploy)*  ·  💼 **LinkedIn:** [in/gurkeerat-sappal](https://www.linkedin.com/in/gurkeerat-sappal)  ·  ✉️ **gurkeeratsappal@gmail.com**

**Toolbox:** Python · TypeScript · PyTorch · LLM agents & tool-calling · model fine-tuning (LoRA) & serving (vLLM) · real-time voice (LiveKit) · RAG · FastAPI
