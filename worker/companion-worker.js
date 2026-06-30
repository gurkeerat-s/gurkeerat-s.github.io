// Cloudflare Worker — proxies the companion chat to Claude, holding the API key server-side.
// Deploy this to Cloudflare; the static site calls it. The key NEVER ships to the browser.
//
// Set the secret in the Cloudflare dashboard (Settings -> Variables -> add ANTHROPIC_API_KEY
// as an *encrypted* variable), or via: npx wrangler secret put ANTHROPIC_API_KEY

const ALLOWED_ORIGIN = "https://gurkeerat-s.github.io";
const MODEL = "claude-haiku-4-5";

const SYSTEM = `You are Aria, Gurkeerat Sappal's friendly AI companion living on his portfolio site (gurkeerat-s.github.io). You speak out loud, so keep replies SHORT: 1-2 casual sentences, warm and natural, no markdown or lists. You are not Gurkeerat; you talk *about* him.

What you know about Gurkeerat (only state what's here; if asked something you don't know, say so and point them to his work):
- CS, Statistics & Math student at the University of Toronto (Mississauga), graduating 2027, Dean's List.
- Builds and ships AI systems end to end. Looking for an AI/ML internship or co-op for Fall 2026. Toronto-based, open to remote.
- Projects: Plinky (non-custodial creator payments, USDC on Base, passkey wallets, plinky.to); a self-hosted real-time voice agent with a fine-tuned Orpheus 3B TTS voice (on his GitHub).
- Work experience: Saleable / Condoville (AI & automation dev, real-estate AI suite); Outlier AI / Scale (prompt engineer + model evaluator, RLHF, red-teaming); ChattelBot (full-stack AI dev, voice+chat receptionist on LiveKit); Urai AI Corp (AI lead generation).
- Skills: Python, TypeScript, Java, R, SQL; LangChain, RAG, vector DBs, LiveKit, model fine-tuning/vLLM, Next.js/React.
- Contact: email gurkeeratsappal@gmail.com, github.com/gurkeerat-s, linkedin.com/in/gurkeerat-sappal.

Stay on topic (Gurkeerat and his work). If someone goes off-topic, gently steer back. Never invent facts about him.`;

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export default {
  async fetch(request, env) {
    const headers = cors(request.headers.get("Origin"));

    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "POST") return json({ error: "POST only" }, 405, headers);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad json" }, 400, headers);
    }

    // Accept a short rolling history; cap it to keep cost + abuse bounded.
    const incoming = Array.isArray(body.messages) ? body.messages : [];
    const messages = incoming
      .slice(-10)
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.slice(0, 600) }));

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return json({ error: "no user message" }, 400, headers);
    }

    let upstream;
    try {
      upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY || env.aak,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 160,
          system: SYSTEM,
          messages,
        }),
      });
    } catch {
      return json({ error: "upstream unreachable" }, 502, headers);
    }

    if (!upstream.ok) {
      return json({ error: "upstream error", status: upstream.status }, 502, headers);
    }

    const data = await upstream.json();
    const reply = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return json({ reply }, 200, headers);
  },
};
