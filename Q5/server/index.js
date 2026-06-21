require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY || GEMINI_API_KEY === "your_gemini_api_key_here") {
  console.error("❌  GEMINI_API_KEY is not set. Add it to server/.env and restart.");
  process.exit(1);
}

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

async function callGemini(prompt) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  };

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Gemini API error");
  return data.candidates[0].content.parts[0].text;
}

// Generate interview questions
app.post("/api/generate-questions", async (req, res) => {
  const { jobTitle, jobDescription, experienceLevel, focusAreas } = req.body;

  const prompt = `You are an expert HR consultant helping a non-technical hiring manager interview candidates for a technical role.

Job Title: ${jobTitle}
Job Description: ${jobDescription}
Experience Level: ${experienceLevel}
Focus Areas: ${focusAreas || "general"}

Generate a structured interview guide with:

1. **OPENING QUESTIONS** (2-3 questions to warm up the candidate)
2. **TECHNICAL COMPETENCY QUESTIONS** (5-6 questions that even a non-technical interviewer can ask and evaluate — include what a GOOD answer looks like vs a BAD answer)
3. **BEHAVIORAL QUESTIONS** (3-4 situational questions relevant to this role)
4. **RED FLAG CHECKLIST** (5-7 specific warning signs to watch out for in candidate answers)
5. **CLOSING QUESTIONS** (2 questions for the candidate to ask)

Format each question clearly. For technical questions, add a brief "What to listen for:" note so the non-technical interviewer knows what a strong answer sounds like.

Keep language simple and practical — the interviewer has no technical background.`;

  try {
    const text = await callGemini(prompt);
    res.json({ result: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Analyze candidate answer for red flags
app.post("/api/analyze-answer", async (req, res) => {
  const { jobTitle, question, candidateAnswer } = req.body;

  const prompt = `You are an expert HR consultant. A non-technical hiring manager is interviewing a candidate for the role of: ${jobTitle}.

The interviewer asked: "${question}"
The candidate answered: "${candidateAnswer}"

Please analyze this answer and provide:
1. **OVERALL RATING**: Green ✅ / Yellow ⚠️ / Red 🚨 (with one sentence why)
2. **WHAT'S GOOD**: Any positive signals in the answer
3. **RED FLAGS**: Any concerning signals or vague/evasive responses
4. **FOLLOW-UP QUESTION**: One follow-up question the interviewer should ask to dig deeper

Keep it brief and actionable. Use plain language — the interviewer is not technical.`;

  try {
    const text = await callGemini(prompt);
    res.json({ result: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
