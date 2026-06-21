const { callGemini } = require('./geminiClient');

const SYSTEM_PROMPT = `You are the Intent Parser Agent for UKS (Universitätsklinikum des Saarlandes) hospital HR system.
Your job is to analyze HR messages and extract structured information about shift replacement needs.

Extract the following from the message:
- intent: one of ["find_replacement", "list_staff", "check_availability", "general_query", "unknown"]
- absentEmployee: name or ID of the person calling in sick (if mentioned)
- department: department name (if mentioned)
- role: job role needed (if mentioned)
- shiftDate: date of the shift (if mentioned)
- shiftType: "Night", "Day", or null
- requiredCertifications: array of certifications needed
- urgency: "critical" | "high" | "normal"
- additionalContext: any other relevant details

Respond with ONLY a valid JSON object. No explanation.`;

async function parseIntent(userMessage) {
  const result = await callGemini(
    null,
    SYSTEM_PROMPT,
    `Parse this HR message:\n"${userMessage}"`,
    true
  );

  return {
    ...result,
    raw: userMessage
  };
}

module.exports = { parseIntent };
