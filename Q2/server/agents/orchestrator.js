const { parseIntent } = require('./intentParser');
const { analyzeSchedule } = require('./scheduleAnalyzer');
const { generateOutreach } = require('./outreachAgent');
const { synthesizeResponse } = require('./responseSynthesizer');
const { callGemini } = require('./geminiClient');

async function runOrchestrator({ userMessage, scheduleData, conversationHistory, onEvent }) {
  const agentTrace = [];

  const emit = (type, agentName, data) => {
    const event = { type, agentName, data, timestamp: new Date().toISOString() };
    agentTrace.push(event);
    if (onEvent) onEvent(event);
  };

  try {
    // Step 1: Parse Intent
    emit('agent_start', 'Intent Parser', { message: 'Analyzing your request...' });
    const intent = await parseIntent(userMessage);
    emit('agent_complete', 'Intent Parser', {
      intent: intent.intent,
      details: `Detected: ${intent.intent} | Department: ${intent.department || 'auto-detect'} | Shift: ${intent.shiftType || 'auto-detect'}`
    });

    // Handle general queries differently
    if (intent.intent === 'general_query' || intent.intent === 'unknown') {
      emit('agent_start', 'General Assistant', { message: 'Answering your question...' });
      const context = buildScheduleContext(scheduleData);
      const answer = await callGemini(
        null,
        `You are the UKS hospital shift management assistant. Answer questions about the schedule concisely. Available data context: ${context}`,
        userMessage,
        false
      );
      emit('agent_complete', 'General Assistant', { message: 'Response ready' });
      return { summary: answer, intent, agentTrace, candidates: [], outreach: [] };
    }

    // Step 2: Analyze Schedule
    emit('agent_start', 'Schedule Analyzer', { message: 'Scanning staff roster and schedule...' });
    const analysis = await analyzeSchedule(intent, scheduleData);
    const qualifiedCount = (analysis.candidates || []).filter(c => c.isQualified).length;
    emit('agent_complete', 'Schedule Analyzer', {
      candidatesFound: qualifiedCount,
      totalScanned: (analysis.candidates || []).length,
      details: `Found ${qualifiedCount} qualified candidates out of ${(analysis.candidates || []).length} evaluated`
    });

    // Step 3: Generate Outreach
    emit('agent_start', 'Outreach Agent', { message: `Preparing messages for top ${Math.min(qualifiedCount, 5)} candidates...` });
    const outreach = await generateOutreach(analysis);
    emit('agent_complete', 'Outreach Agent', {
      messagesGenerated: outreach.length,
      details: `Generated ${outreach.length} personalized outreach messages`
    });

    // Step 4: Synthesize Response
    emit('agent_start', 'Response Synthesizer', { message: 'Compiling final report...' });
    const finalResponse = await synthesizeResponse(intent, analysis, outreach, userMessage);
    emit('agent_complete', 'Response Synthesizer', { message: 'Report ready' });

    return { summary: finalResponse, intent, analysis, outreach, agentTrace };

  } catch (err) {
    emit('agent_error', 'Orchestrator', { error: err.message });
    throw err;
  }
}

function buildScheduleContext(scheduleData) {
  const sheetNames = Object.keys(scheduleData);
  return sheetNames.map(name => {
    const rows = scheduleData[name];
    return `Sheet "${name}": ${rows.length} rows, columns: ${rows[0] ? Object.keys(rows[0]).join(', ') : 'empty'}`;
  }).join('\n');
}

module.exports = { runOrchestrator };
