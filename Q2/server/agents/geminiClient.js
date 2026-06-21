const { GoogleGenerativeAI } = require('@google/generative-ai');

async function callGemini(apiKey, systemPrompt, userPrompt, jsonMode = false) {
  // Use the server-side env key — the apiKey param is kept for
  // backwards-compatible call signatures but is no longer used.
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is not set. Add it to server/.env and restart.');
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: jsonMode
      ? { responseMimeType: 'application/json', temperature: 0.1 }
      : { temperature: 0.3 }
  });

  const prompt = systemPrompt
    ? `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\nUSER:\n${userPrompt}`
    : userPrompt;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  if (jsonMode) {
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) return JSON.parse(match[1]);
      return JSON.parse(text.replace(/^[^{[]*/, '').replace(/[^}\]]*$/, ''));
    }
  }

  return text;
}

module.exports = { callGemini };
