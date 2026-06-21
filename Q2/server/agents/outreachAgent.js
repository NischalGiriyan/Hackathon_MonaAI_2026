const { callGemini } = require('./geminiClient');

const SYSTEM_PROMPT = `You are the Outreach Agent for UKS (Universitätsklinikum des Saarlandes) hospital HR.
You craft professional, urgent but respectful outreach messages in German to staff members asking them to cover a shift.

Guidelines:
- Write in German (formal "Sie" form)
- Be clear about the shift details (date, time, department)
- Mention why they are being contacted (qualifications match)
- Keep it brief but complete (3-4 sentences)
- Include a clear call to action
- Add urgency without being aggressive
- Reference UKS Homburg

Return a JSON array of outreach objects:
[
  {
    "employeeId": "",
    "employeeName": "",
    "phone": "",
    "rank": 1,
    "message": "SMS/WhatsApp message in German",
    "emailSubject": "Email subject in German",
    "emailBody": "Longer email version in German"
  }
]`;

async function generateOutreach(analysisResult) {
  const topCandidates = (analysisResult.candidates || [])
    .filter(c => c.isQualified)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5);

  if (topCandidates.length === 0) {
    return [];
  }

  const userPrompt = `
SHIFT DETAILS:
${JSON.stringify(analysisResult.shiftDetails, null, 2)}

ABSENT EMPLOYEE:
${JSON.stringify(analysisResult.absentEmployee, null, 2)}

REQUIRED ROLE: ${analysisResult.requiredCriteria?.role || 'Registered Nurse'}
DEPARTMENT: ${analysisResult.requiredCriteria?.department || 'ICU'}
CERTIFICATIONS NEEDED: ${(analysisResult.requiredCriteria?.certifications || []).join(', ')}

TOP CANDIDATES TO CONTACT:
${JSON.stringify(topCandidates, null, 2)}

Generate personalized outreach messages for each candidate. Address them by first name.
Each message should feel personal, not automated.
`;

  const result = await callGemini(null, SYSTEM_PROMPT, userPrompt, true);
  return Array.isArray(result) ? result : (result.messages || result.outreach || []);
}

module.exports = { generateOutreach };
