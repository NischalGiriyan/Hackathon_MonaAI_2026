const { callGemini } = require('./geminiClient');

const SYSTEM_PROMPT = `You are the Response Synthesizer for UKS hospital HR shift management system.
You create clear, actionable summaries for HR staff based on agent analysis results.

Your response should:
1. Confirm what the urgent need is (who called in sick, what shift)
2. Present the top qualified candidates in a clear ranked list
3. Show outreach messages that will be sent
4. Give clear next steps
5. Note any concerns (e.g., nobody available, hours caps reached)

Format your response in clean markdown. Use emojis sparingly for scannability.
Be concise — HR is under time pressure.`;

async function synthesizeResponse(intent, analysis, outreach, userMessage) {
  const userPrompt = `
ORIGINAL HR REQUEST: "${userMessage}"

INTENT PARSED: ${JSON.stringify(intent, null, 2)}

ANALYSIS RESULT:
- Absent: ${analysis.absentEmployee?.name} (${analysis.absentEmployee?.role}, ${analysis.absentEmployee?.department})
- Shift: ${analysis.shiftDetails?.type} shift on ${analysis.shiftDetails?.date}
- Qualified candidates found: ${(analysis.candidates || []).filter(c => c.isQualified).length}

TOP CANDIDATES:
${JSON.stringify((analysis.candidates || []).filter(c => c.isQualified).slice(0, 5), null, 2)}

OUTREACH MESSAGES PREPARED:
${JSON.stringify(outreach.slice(0, 5), null, 2)}

ANALYSIS SUMMARY: ${analysis.summary || ''}

Create a comprehensive HR response. Structure:
1. 🚨 Situation summary
2. ✅ Qualified candidates (ranked list with key info)
3. 📱 Outreach messages sent (show SMS preview for top 3)
4. ⚠️ Any caveats or concerns
5. 📋 Recommended next steps
`;

  return await callGemini(null, SYSTEM_PROMPT, userPrompt, false);
}

module.exports = { synthesizeResponse };
