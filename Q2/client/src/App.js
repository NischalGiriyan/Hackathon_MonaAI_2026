import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './App.css';

const API = 'http://localhost:3001/api';

const AGENT_META = {
  'Intent Parser': { icon: '🧠', color: '#6366f1' },
  'Schedule Analyzer': { icon: '📋', color: '#0ea5e9' },
  'Outreach Agent': { icon: '📱', color: '#10b981' },
  'Response Synthesizer': { icon: '✍️', color: '#f59e0b' },
  'General Assistant': { icon: '💬', color: '#8b5cf6' },
  'Orchestrator': { icon: '⚙️', color: '#ef4444' },
};

function AgentBadge({ name, status, details }) {
  const meta = AGENT_META[name] || { icon: '🤖', color: '#64748b' };
  return (
    <div className={`agent-badge ${status}`} style={{ borderColor: meta.color }}>
      <div className="agent-badge-header">
        <span className="agent-icon">{meta.icon}</span>
        <span className="agent-name" style={{ color: meta.color }}>{name}</span>
        <span className={`agent-status-dot ${status}`} />
        {status === 'running' && <div className="agent-spinner" style={{ borderTopColor: meta.color }} />}
        {status === 'complete' && <span className="agent-check" style={{ color: meta.color }}>✓</span>}
        {status === 'error' && <span className="agent-check" style={{ color: '#ef4444' }}>✗</span>}
      </div>
      {details && <div className="agent-details">{details}</div>}
    </div>
  );
}

function AgentPipeline({ events }) {
  const agentStates = {};
  for (const e of events) {
    if (e.type === 'agent_start') agentStates[e.agentName] = { status: 'running', details: e.data?.message };
    if (e.type === 'agent_complete') agentStates[e.agentName] = { status: 'complete', details: e.data?.details || e.data?.message };
    if (e.type === 'agent_error') agentStates[e.agentName] = { status: 'error', details: e.data?.error };
  }

  if (Object.keys(agentStates).length === 0) return null;

  return (
    <div className="agent-pipeline">
      <div className="pipeline-label">🔄 Agent Pipeline</div>
      <div className="pipeline-agents">
        {Object.entries(agentStates).map(([name, state]) => (
          <AgentBadge key={name} name={name} status={state.status} details={state.details} />
        ))}
      </div>
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`message ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && (
        <div className="message-avatar">
          <span>🏥</span>
        </div>
      )}
      <div className="message-content-wrap">
        {msg.agentEvents && msg.agentEvents.length > 0 && (
          <AgentPipeline events={msg.agentEvents} />
        )}
        <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
          {isUser ? (
            <p>{msg.content}</p>
          ) : (
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          )}
        </div>
        <div className="message-time">{new Date(msg.timestamp).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}

function SetupPanel({ onSessionReady }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const loadDefault = async () => {
    setLoading(true); setError('');
    try {
      const res = await axios.post(`${API}/load-default`);
      onSessionReady(res.data.sessionId, res.data.fileName);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load default schedule');
    } finally { setLoading(false); }
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setLoading(true); setError('');
    const fd = new FormData();
    fd.append('schedule', file);
    try {
      const res = await axios.post(`${API}/upload`, fd);
      onSessionReady(res.data.sessionId, res.data.fileName);
    } catch (e) {
      setError(e.response?.data?.error || 'Upload failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="setup-panel">
      <div className="setup-logo">
        <div className="logo-cross">🏥</div>
        <h1>UKS Shift Replacement Agent</h1>
        <p>Universitätsklinikum des Saarlandes — Homburg</p>
      </div>

      <div className="setup-card">
        <h2>Load Schedule</h2>

        <div className="form-group">
          <label>Schedule File</label>
          <div className="file-buttons">
            <button
              className="btn btn-primary"
              onClick={loadDefault}
              disabled={loading}
            >
              {loading ? '⏳ Loading...' : '📂 Use Demo Schedule (UKS)'}
            </button>
            <span className="or-divider">or</span>
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={loading}>
              ⬆️ Upload XLSX
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
              onChange={e => handleUpload(e.target.files[0])} />
          </div>
        </div>

        {error && <div className="error-msg">⚠️ {error}</div>}
      </div>

      <div className="setup-agents-preview">
        <h3>Multi-Agent Pipeline</h3>
        <div className="agents-flow">
          {Object.entries(AGENT_META).slice(0, 4).map(([name, meta]) => (
            <div key={name} className="agent-flow-item">
              <div className="agent-flow-icon" style={{ background: meta.color + '22', border: `1px solid ${meta.color}` }}>
                {meta.icon}
              </div>
              <span>{name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatPanel({ sessionId, fileName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [currentEvents, setCurrentEvents] = useState([]);
  const bottomRef = useRef();

  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: `## Willkommen beim UKS Shift Replacement Agent 👋\n\nSchedule loaded: **${fileName}**\n\nI'm ready to help you fill last-minute shift gaps. You can:\n- Tell me about a sick call: *"Felix Haddad just called in sick for the ICU night shift tonight"*\n- Ask for available staff: *"Who can cover the ICU night shift on Sat 06/20?"*\n- Check qualifications: *"List all Registered Nurses with ACLS who are off tonight"*\n\nWhat's the situation?`,
      timestamp: new Date().toISOString(),
      agentEvents: []
    }]);
  }, [fileName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentEvents]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming) return;
    const userMsg = input.trim();
    setInput('');

    setMessages(prev => [...prev, {
      role: 'user',
      content: userMsg,
      timestamp: new Date().toISOString()
    }]);

    setStreaming(true);
    setCurrentEvents([]);

    try {
      const response = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: userMsg })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult = null;
      let accumulatedEvents = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'agent_start' || data.type === 'agent_complete' || data.type === 'agent_error') {
                accumulatedEvents = [...accumulatedEvents, data];
                setCurrentEvents([...accumulatedEvents]);
              } else if (data.type === 'done') {
                finalResult = data.result;
              } else if (data.type === 'error') {
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: `❌ Error: ${data.message}`,
                  timestamp: new Date().toISOString(),
                  agentEvents: accumulatedEvents
                }]);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }

      if (finalResult) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: finalResult.summary,
          timestamp: new Date().toISOString(),
          agentEvents: accumulatedEvents
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Connection error: ${err.message}`,
        timestamp: new Date().toISOString(),
        agentEvents: []
      }]);
    } finally {
      setStreaming(false);
      setCurrentEvents([]);
    }
  }, [input, streaming, sessionId]);

  const QUICK_PROMPTS = [
    "Felix Haddad called in sick for the ICU night shift tonight (Sat 06/20). Find a replacement.",
    "Who are qualified Registered Nurses with ACLS available for night shifts?",
    "List all ICU staff who are off on Sat 06/20",
    "Show me all staff currently on leave"
  ];

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="header-icon">🏥</span>
          <div>
            <h2>UKS Shift Agent</h2>
            <span className="header-sub">Gemini Flash 2.5 · {fileName}</span>
          </div>
        </div>
        <div className="status-dot active" title="Connected" />
      </div>

      <div className="messages-area">
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}

        {streaming && currentEvents.length > 0 && (
          <div className="message assistant">
            <div className="message-avatar"><span>🏥</span></div>
            <div className="message-content-wrap">
              <AgentPipeline events={currentEvents} />
              <div className="thinking-indicator">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div className="quick-prompts">
          <div className="quick-label">Quick examples:</div>
          {QUICK_PROMPTS.map((p, i) => (
            <button key={i} className="quick-btn" onClick={() => setInput(p)}>
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="input-area">
        <textarea
          placeholder="Describe the shift coverage situation... (e.g., 'Dr. Smith called in sick for ICU night shift')"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          rows={2}
          disabled={streaming}
        />
        <button
          className={`send-btn ${streaming ? 'sending' : ''}`}
          onClick={sendMessage}
          disabled={!input.trim() || streaming}
        >
          {streaming ? '⏳' : '➤'}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [fileName, setFileName] = useState('');

  const handleSessionReady = (sid, fname) => {
    setSessionId(sid);
    setFileName(fname);
  };

  return (
    <div className="app">
      {!sessionId ? (
        <SetupPanel onSessionReady={handleSessionReady} />
      ) : (
        <ChatPanel sessionId={sessionId} fileName={fileName} />
      )}
    </div>
  );
}
