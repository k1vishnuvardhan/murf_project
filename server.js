const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const MURF_API_KEY = process.env.MURF_API_KEY;
const MURF_VOICE_ID = process.env.MURF_VOICE_ID || "en-US-natalie";
const MURF_API_URL = "https://api.murf.ai/v1/speech/generate";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "openrouter/auto";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:5501",
  "http://localhost:5501",
  "http://127.0.0.1:3000",
  "http://localhost:3000"
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function generateBotReply(message) {
  const normalized = message.toLowerCase();

  if (normalized.includes("hello") || normalized.includes("hi")) {
    return "Hello! I am your astronomy voice assistant. Ask me about planets, stars, black holes, galaxies, or space missions.";
  }

  if (normalized.includes("who are you") || normalized.includes("what can you do")) {
    return "I am a browser-based astronomy assistant that explains space topics, answers questions about the universe, and speaks responses aloud.";
  }

  if (
    normalized.includes("planet")
    || normalized.includes("star")
    || normalized.includes("galaxy")
    || normalized.includes("moon")
    || normalized.includes("black hole")
    || normalized.includes("nasa")
    || normalized.includes("space")
  ) {
    return `You asked about space: ${message}. I can help explain astronomy concepts, solar system facts, missions, and cosmic phenomena in a simple way.`;
  }

  if (normalized.includes("time")) {
    return "I cannot check your local clock directly, but I can absolutely help with astronomy questions, constellations, planets, and space science.";
  }

  if (normalized.includes("weather")) {
    return "I do not have live weather data connected right now, but I can still help with sky, space, and astronomy questions.";
  }

  if (normalized.includes("bye")) {
    return "Goodbye. I will be here whenever you want to explore the universe again.";
  }

  return `I am tuned for astronomy-first conversations. Ask me about planets, stars, galaxies, telescopes, black holes, astronauts, or space exploration.`;
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(
      (entry) =>
        entry
        && (entry.role === "user" || entry.role === "assistant")
        && typeof entry.content === "string"
        && entry.content.trim()
    )
    .slice(-12)
    .map((entry) => ({
      role: entry.role,
      content: entry.content.trim()
    }));
}

function astronomySystemPrompt() {
  return "You are a premium futuristic astronomy voice assistant. Your main purpose is to answer questions about space, astronomy, planets, stars, galaxies, cosmology, observatories, and space missions. Stay focused on astronomy by default, respond naturally, stay concise, and preserve helpful conversational continuity from prior turns. If a question is outside astronomy, answer briefly but try to relate it back to space or clearly state that your specialty is astronomy.";
}

async function generateOpenRouterReply(message, history = []) {
  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-OpenRouter-Title": "Murf Voice Bot Hackathon"
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      temperature: 0.5,
      max_tokens: 180,
      messages: [
        {
          role: "system",
          content: astronomySystemPrompt()
        },
        ...normalizeHistory(history),
        {
          role: "user",
          content: message
        }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "OpenRouter API request failed.");
  }

  return data.choices?.[0]?.message?.content?.trim() || generateBotReply(message);
}

function buildGeminiContents(history, message) {
  const contents = normalizeHistory(history).map((entry) => ({
    role: entry.role === "assistant" ? "model" : "user",
    parts: [{ text: entry.content }]
  }));

  contents.push({
    role: "user",
    parts: [{ text: message }]
  });

  return contents;
}

async function generateGeminiReply(message, history = []) {
  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: astronomySystemPrompt()
          }
        ]
      },
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 180
      },
      contents: buildGeminiContents(history, message)
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Gemini API request failed.");
  }

  return data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim() || generateBotReply(message);
}

async function generateContextualReply(message, history = []) {
  if (OPENROUTER_API_KEY) {
    return generateOpenRouterReply(message, history);
  }

  if (GEMINI_API_KEY) {
    return generateGeminiReply(message, history);
  }

  return generateBotReply(message);
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    murfConfigured: Boolean(MURF_API_KEY),
    openRouterConfigured: Boolean(OPENROUTER_API_KEY),
    geminiConfigured: Boolean(GEMINI_API_KEY),
    voiceId: MURF_VOICE_ID,
    llmModel: OPENROUTER_API_KEY ? OPENROUTER_MODEL : GEMINI_MODEL
  });
});

app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "A message string is required." });
  }

  try {
    const reply = await generateContextualReply(message.trim(), history);
    return res.json({
      reply,
      provider: OPENROUTER_API_KEY
        ? "openrouter"
        : GEMINI_API_KEY
          ? "gemini"
          : "fallback"
    });
  } catch (error) {
    const fallbackReply = generateBotReply(message.trim());
    return res.json({
      reply: fallbackReply,
      provider: "fallback",
      warning: `OpenRouter unavailable: ${error.message}`
    });
  }
});

app.post("/api/voice", async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "A text string is required." });
  }

  if (!MURF_API_KEY) {
    return res.status(500).json({
      error: "Missing MURF_API_KEY. Add it to your .env file before using voice output."
    });
  }

  try {
    const response = await fetch(MURF_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": MURF_API_KEY
      },
      body: JSON.stringify({
        text,
        voiceId: MURF_VOICE_ID,
        format: "MP3"
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.message || "Murf API request failed.",
        details: data
      });
    }

    return res.json({
      audioUrl: data.audioFile,
      encodedAudio: data.encodedAudio || null,
      duration: data.audioLengthInSeconds || null
    });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to reach Murf API.",
      details: error.message
    });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Voice bot running on ${HOST}:${PORT}`);
});
