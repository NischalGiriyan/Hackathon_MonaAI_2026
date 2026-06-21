const { callGemini } = require('./geminiClient');

const SYSTEM_PROMPT = `You are the Schedule Analyzer Agent for UKS hospital HR.
You analyze staff roster and schedule data to find qualified replacements for shifts.

Given the schedule data and intent, identify:
1. The absent employee details
2. All potentially qualified staff
3. For each candidate evaluate:
   - Role match (exact or acceptable substitution)
   - Has required certifications
   - Status is "Active" (not "On Leave")
   - Schedule shows "O" (Off) on the needed shift date
   - Rest check: not finishing a Day shift (D) that same day, and not finishing a Night shift from the previous night
   - Weekly hours cap: adding 12 hrs won't exceed their Max Hrs/Week
   - Overtime OK flag
   - Shift preference alignment
4. Rank candidates: best fit first (ICU/same-dept first, then adjacent, then general)
5. Note tiebreakers: "Open to last-minute cover", "Night-owl", shift preference = Night, Overtime OK = Yes

Shift codes: D = Day (07:00-19:00), N = Night (19:00-07:00), O = Off

You MUST return a valid JSON with this structure:
{
  "absentEmployee": { "id": "", "name": "", "role": "", "department": "", "certifications": [], "phone": "" },
  "shiftDetails": { "date": "", "dayColumn": "", "type": "Night|Day", "start": "", "end": "" },
  "requiredCriteria": { "role": "", "certifications": [], "department": "" },
  "candidates": [
    {
      "employeeId": "",
      "name": "",
      "role": "",
      "department": "",
      "certifications": [],
      "phone": "",
      "contractType": "",
      "maxHrsWeek": 0,
      "scheduledHrs": 0,
      "shiftPreference": "",
      "overtimeOk": "",
      "status": "",
      "notes": "",
      "scheduledOnDate": "O|D|N",
      "qualificationScore": 0,
      "qualificationReasons": [],
      "disqualificationReasons": [],
      "isQualified": true,
      "rank": 1
    }
  ],
  "topCandidates": [],
  "summary": "Brief text summary of findings"
}`;

async function analyzeSchedule(intent, scheduleData) {
  const roster = scheduleData['Roster'] || [];
  const schedule = scheduleData['Weekly_Schedule'] || [];
  const shiftRef = scheduleData['Shift_Reference'] || [];
  const scenario = scheduleData['Scenario'] || [];

  const dataPayload = JSON.stringify({
    roster: roster.slice(0, 100),
    schedule: schedule.slice(0, 100),
    shiftReference: shiftRef,
    scenarioContext: scenario
  });

  const userPrompt = `
INTENT FROM HR:
${JSON.stringify(intent, null, 2)}

SCHEDULE DATA (from uploaded XLSX):
${dataPayload}

Based on the intent and ALL the schedule data above:
1. Identify the absent employee (check the Scenario sheet and intent for clues)
2. Find all qualified candidates for the replacement shift
3. Rank them by best fit

Remember: 
- If "Sat 06/20" is mentioned, look at column "Sat 06/20" in the Weekly_Schedule
- Night shift is 19:00-07:00, Day shift is 07:00-19:00
- A staff member finishing a Night shift (N) on Fri 06/19 means they clock out on Sat 06/20 morning — they'd be resting and cannot do a Night on Sat 06/20 evening
- Check scheduled hours won't exceed max hours/week
`;

  return await callGemini(null, SYSTEM_PROMPT, userPrompt, true);
}

module.exports = { analyzeSchedule };
