require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx');
const { runOrchestrator } = require('./agents/orchestrator');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// Store active sessions in memory
const sessions = {};

// Ensure uploads dir exists
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Parse XLSX into structured data
function parseScheduleFile(filePath) {
  const wb = XLSX.readFile(filePath);
  const result = {};

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    result[sheetName] = XLSX.utils.sheet_to_json(ws, { defval: null });
  }

  return result;
}

// Upload schedule file
app.post('/api/upload', upload.single('schedule'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const sessionId = uuidv4();
    const scheduleData = parseScheduleFile(req.file.path);

    sessions[sessionId] = {
      id: sessionId,
      filePath: req.file.path,
      fileName: req.file.originalname,
      scheduleData,
      messages: [],
      createdAt: new Date().toISOString()
    };

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    const sheetNames = Object.keys(scheduleData);
    const rowCounts = {};
    for (const s of sheetNames) rowCounts[s] = scheduleData[s].length;

    res.json({
      sessionId,
      fileName: req.file.originalname,
      sheets: sheetNames,
      rowCounts,
      message: 'Schedule loaded successfully'
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Load default schedule file
app.post('/api/load-default', (req, res) => {
  try {
    const defaultPath = path.join(__dirname, 'hospital_schedule_part_2.xlsx');
    if (!fs.existsSync(defaultPath)) {
      return res.status(404).json({ error: 'Default schedule file not found' });
    }

    const sessionId = uuidv4();
    const scheduleData = parseScheduleFile(defaultPath);

    sessions[sessionId] = {
      id: sessionId,
      filePath: defaultPath,
      fileName: 'hospital_schedule_part_2.xlsx',
      scheduleData,
      messages: [],
      createdAt: new Date().toISOString()
    };

    const sheetNames = Object.keys(scheduleData);
    const rowCounts = {};
    for (const s of sheetNames) rowCounts[s] = scheduleData[s].length;

    res.json({
      sessionId,
      fileName: 'hospital_schedule_part_2.xlsx',
      sheets: sheetNames,
      rowCounts,
      message: 'Default schedule loaded'
    });
  } catch (err) {
    console.error('Load default error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Send message to agent
app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;

  if (!sessionId || !sessions[sessionId]) {
    return res.status(400).json({ error: 'Invalid or expired session. Please upload a schedule first.' });
  }
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const session = sessions[sessionId];
  session.messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });

  try {
    // Stream SSE response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const result = await runOrchestrator({
      userMessage: message,
      scheduleData: session.scheduleData,
      conversationHistory: session.messages,
      onEvent: sendEvent
    });

    session.messages.push({
      role: 'assistant',
      content: result.summary,
      timestamp: new Date().toISOString(),
      agentTrace: result.agentTrace
    });

    sendEvent({ type: 'done', result });
    res.end();
  } catch (err) {
    console.error('Chat error:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    res.end();
  }
});

// Get session info
app.get('/api/session/:sessionId', (req, res) => {
  const session = sessions[req.params.sessionId];
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({
    id: session.id,
    fileName: session.fileName,
    messageCount: session.messages.length,
    createdAt: session.createdAt
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🏥 UKS Shift Agent Server running on port ${PORT}`);
});
