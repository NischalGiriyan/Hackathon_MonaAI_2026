require("dotenv").config();
const express = require("express");
const fetch   = require("node-fetch");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY || GEMINI_API_KEY === "your_gemini_api_key_here") {
  console.error("❌  GEMINI_API_KEY is not set. Add it to server/.env and restart.");
  process.exit(1);
}

app.use(express.json({ limit: "2mb" }));

// Serve frontend files from /public
app.use(express.static(path.join(__dirname, "../public")));

// ── Gemini proxy endpoint ────────────────────────────────────
// POST /api/gemini  { model, prompt, systemContext?, generationConfig? }
app.post("/api/gemini", async (req, res) => {
  const { model = "gemini-2.5-flash", prompt, systemContext, generationConfig } = req.body;

  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  const fullPrompt = systemContext ? `${systemContext}\n\n${prompt}` : prompt;

  const geminiBody = {
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    generationConfig: generationConfig || { temperature: 0.3, maxOutputTokens: 1500 },
  };

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(geminiBody) }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({ error: data?.error?.message || `Gemini error ${geminiRes.status}` });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.json({ text });
  } catch (err) {
    console.error("Gemini proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Catch-all → index.html
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`✅  Dr. Theiss Analytics Agent running at http://localhost:${PORT}`);
});
