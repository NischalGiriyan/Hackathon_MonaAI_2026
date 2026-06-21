/**
 * server/index.js — Express backend for Globus Group Invoice Agent
 *
 * Keeps the Gemini API key secure in .env — never exposed to the browser.
 * The frontend calls /api/gemini instead of the Gemini API directly.
 */

require('dotenv').config();
const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const GEMINI_KEY   = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE  = 'https://generativelanguage.googleapis.com/v1beta/models';

if (!GEMINI_KEY || GEMINI_KEY === 'your_gemini_api_key_here') {
  console.error('❌  GEMINI_API_KEY is not set. Edit your .env file and restart.');
  process.exit(1);
}

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '20mb' })); // allow large base64 image payloads
app.use(express.static(path.join(__dirname, '../public')));

// ── Gemini proxy endpoint ───────────────────────────────────────────────────
// POST /api/gemini
// Body: { prompt: string, imageBase64?: string, mimeType?: string }
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt, imageBase64, mimeType } = req.body;

    if (!prompt) return res.status(400).json({ error: 'prompt is required' });

    const parts = [];
    if (imageBase64 && mimeType) {
      parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
    }
    parts.push({ text: prompt });

    const geminiBody = {
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1500 }
    };

    const geminiRes = await fetch(
      `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(geminiBody)
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({}));
      return res.status(geminiRes.status).json({
        error: errBody?.error?.message || `Gemini API error ${geminiRes.status}`
      });
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text });

  } catch (err) {
    console.error('Gemini proxy error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Catch-all → index.html (SPA) ───────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`✅  Globus Invoice Agent running at http://localhost:${PORT}`);
});
