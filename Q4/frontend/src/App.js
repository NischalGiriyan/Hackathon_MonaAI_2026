import React, { useState, useCallback } from "react";
import axios from "axios";
import "./App.css";

// ── constants ────────────────────────────────────────────────
const RISK_COLOR = { LOW: "#22c55e", MEDIUM: "#f59e0b", HIGH: "#ef4444", CRITICAL: "#a855f7" };
const RISK_BG    = { LOW: "rgba(34,197,94,.12)", MEDIUM: "rgba(245,158,11,.12)", HIGH: "rgba(239,68,68,.12)", CRITICAL: "rgba(168,85,247,.12)" };

const STAGES = [
  { id: "extract",  label: "Reading documents",       icon: "📄" },
  { id: "identify", label: "Identifying candidates",  icon: "🔍" },
  { id: "match",    label: "Matching CVs & certificates", icon: "🔗" },
  { id: "analyze",  label: "Running fraud analysis",  icon: "🚨" },
  { id: "done",     label: "Report ready",            icon: "✅" },
];

// ── tiny helpers ─────────────────────────────────────────────
function RiskBadge({ level }) {
  if (!level) return null;
  return (
    <span style={{
      background: RISK_BG[level],
      color: RISK_COLOR[level],
      border: `1px solid ${RISK_COLOR[level]}33`,
      fontSize: 11, fontWeight: 700, padding: "2px 9px",
      borderRadius: 20, letterSpacing: "0.06em", textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>{level}</span>
  );
}

function ScoreBar({ score, label }) {
  const color = score < 30 ? "#22c55e" : score < 60 ? "#f59e0b" : score < 80 ? "#ef4444" : "#a855f7";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {label && <span style={{ fontSize: 12, color: "#64748b", minWidth: 140 }}>{label}</span>}
      <div style={{ flex: 1, height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden", minWidth: 80 }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 3, transition: "width 1s ease" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 30 }}>{score}</span>
    </div>
  );
}

function Collapsible({ title, icon, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="collapsible">
      <button className="collapsible-header" onClick={() => setOpen(o => !o)}>
        <span>{icon} {title}{count != null ? <span className="count-badge">{count}</span> : null}</span>
        <span className="chev">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

function FileDropZone({ label, accepts, files, onFiles, fieldName }) {
  const [drag, setDrag] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    const dropped = Array.from(e.dataTransfer.files);
    onFiles(prev => {
      const existing = prev.map(f => f.name);
      return [...prev, ...dropped.filter(f => !existing.includes(f.name))];
    });
  }, [onFiles]);

  const handleInput = (e) => {
    const picked = Array.from(e.target.files);
    onFiles(prev => {
      const existing = prev.map(f => f.name);
      return [...prev, ...picked.filter(f => !existing.includes(f.name))];
    });
    e.target.value = "";
  };

  const remove = (name) => onFiles(prev => prev.filter(f => f.name !== name));

  return (
    <div className="dropzone-wrap">
      <div className="dropzone-label">{label}</div>
      <div
        className={`dropzone ${drag ? "drag-over" : ""}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById(`input-${fieldName}`).click()}
      >
        <input id={`input-${fieldName}`} type="file" multiple hidden accept={accepts} onChange={handleInput} />
        {files.length === 0 ? (
          <div className="dz-empty">
            <div className="dz-icon">⬆</div>
            <div className="dz-hint">Drop files here or click to browse</div>
            <div className="dz-sub">PDF, DOCX, TXT, JPG, PNG</div>
          </div>
        ) : (
          <div className="dz-files">
            {files.map(f => (
              <div key={f.name} className="dz-file-chip" onClick={e => e.stopPropagation()}>
                <span className="chip-icon">{f.type.includes("image") ? "🖼" : "📄"}</span>
                <span className="chip-name" title={f.name}>{f.name.length > 28 ? f.name.slice(0, 25) + "…" : f.name}</span>
                <button className="chip-remove" onClick={(e) => { e.stopPropagation(); remove(f.name); }}>✕</button>
              </div>
            ))}
            <div className="dz-add-more">＋ Add more</div>
          </div>
        )}
      </div>
      {files.length > 0 && <div className="dz-count">{files.length} file{files.length > 1 ? "s" : ""} selected</div>}
    </div>
  );
}

// ── Summary bar ──────────────────────────────────────────────
function SummaryBar({ summary }) {
  const stats = [
    { label: "Candidates", value: summary.totalCandidates, color: "#94a3b8" },
    { label: "Certificates", value: summary.totalCertificates, color: "#94a3b8" },
    { label: "Critical", value: summary.criticalRisk, color: RISK_COLOR.CRITICAL },
    { label: "High Risk", value: summary.highRisk, color: RISK_COLOR.HIGH },
    { label: "Medium", value: summary.mediumRisk, color: RISK_COLOR.MEDIUM },
    { label: "Clear", value: summary.lowRisk, color: RISK_COLOR.LOW },
  ];
  return (
    <div className="summary-bar">
      {stats.map(s => (
        <div key={s.label} className="summary-stat">
          <div className="stat-val" style={{ color: s.color }}>{s.value}</div>
          <div className="stat-lbl">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Candidate card ───────────────────────────────────────────
function CandidateCard({ result }) {
  const [open, setOpen] = useState(result.fraud?.riskLevel === "HIGH" || result.fraud?.riskLevel === "CRITICAL");
  const { fraud, candidateName, cvFilename, certificates, matchReasoning } = result;

  return (
    <div className={`candidate-card risk-${fraud?.riskLevel?.toLowerCase()}`}>
      {/* Card header — always visible */}
      <button className="card-header" onClick={() => setOpen(o => !o)}>
        <div className="card-header-left">
          <div className="avatar">{(candidateName || "?")[0].toUpperCase()}</div>
          <div className="card-info">
            <div className="card-name">{candidateName || "Unknown Candidate"}</div>
            <div className="card-sub">{cvFilename} · {certificates.length} cert{certificates.length !== 1 ? "s" : ""}</div>
          </div>
        </div>
        <div className="card-header-right">
          <div className="score-pill" style={{ color: RISK_COLOR[fraud?.riskLevel], background: RISK_BG[fraud?.riskLevel] }}>
            {fraud?.overallRiskScore}
          </div>
          <RiskBadge level={fraud?.riskLevel} />
          <span className="chev">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="card-body">
          {/* Verdict */}
          <div className="verdict-row">
            <p className="verdict-text">{fraud?.verdict}</p>
          </div>

          {/* Score bars */}
          <div className="scores-block">
            <ScoreBar score={fraud?.overallRiskScore} label="Overall fraud risk" />
            <ScoreBar score={fraud?.aiGeneratedProbability} label="AI-generated probability" />
          </div>

          {/* Certificate match */}
          {fraud?.certificateMatchNote && (
            <div className="match-note">
              <span className="match-badge match-{fraud.certificateMatchQuality?.toLowerCase()}">
                Cert match: {fraud.certificateMatchQuality}
              </span>
              <span className="match-text">{fraud.certificateMatchNote}</span>
            </div>
          )}

          {/* Matched certs list */}
          {certificates.length > 0 && (
            <div className="certs-list">
              <div className="certs-title">Matched certificates</div>
              {certificates.map((c, i) => (
                <div key={i} className="cert-row">
                  <span className="cert-icon">🎓</span>
                  <div>
                    <div className="cert-name">{c.identity?.certificationTitle || c.filename}</div>
                    <div className="cert-meta">{c.identity?.issuingBody || ""}{c.identity?.issueDate ? ` · ${c.identity.issueDate}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Red flags */}
          {fraud?.redFlags?.length > 0 && (
            <Collapsible title="Red Flags" icon="🚩" count={fraud.redFlags.length} defaultOpen>
              <div className="flags-list">
                {fraud.redFlags.map((f, i) => (
                  <div key={i} className={`flag-item sev-${f.severity?.toLowerCase()}`}>
                    <div className="flag-top">
                      <span className="flag-cat">{f.category}</span>
                      <span className={`sev-badge sev-${f.severity?.toLowerCase()}`}>{f.severity}</span>
                    </div>
                    <div className="flag-desc">{f.description}</div>
                    {f.detail && <div className="flag-detail">{f.detail}</div>}
                  </div>
                ))}
              </div>
            </Collapsible>
          )}

          {/* Positive signals */}
          {fraud?.positiveSignals?.length > 0 && (
            <Collapsible title="Positive Signals" icon="✅" count={fraud.positiveSignals.length}>
              <ul className="positive-list">
                {fraud.positiveSignals.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </Collapsible>
          )}

          {/* CV analysis */}
          {fraud?.cvAnalysis && (
            <Collapsible title="Work History Analysis" icon="💼">
              <div className="kv-block">
                {Object.entries(fraud.cvAnalysis).map(([k, v]) => (
                  <div key={k} className="kv-row">
                    <div className="kv-key">{k.replace(/([A-Z])/g, " $1")}</div>
                    <div className="kv-val">{v}</div>
                  </div>
                ))}
              </div>
            </Collapsible>
          )}

          {/* Per-cert analysis */}
          {fraud?.certificateAnalysis?.length > 0 && (
            <Collapsible title="Certificate Breakdown" icon="🎓">
              <div className="cert-analysis-list">
                {fraud.certificateAnalysis.map((ca, i) => (
                  <div key={i} className={`cert-analysis-row ${ca.authentic === false ? "cert-suspect" : ca.authentic === true ? "cert-ok" : ""}`}>
                    <div className="cert-a-name">{ca.certName}</div>
                    <div className={`cert-a-status ${ca.authentic === false ? "status-fake" : ca.authentic === true ? "status-ok" : "status-unknown"}`}>
                      {ca.authentic === true ? "✓ Likely genuine" : ca.authentic === false ? "✗ Suspicious" : "? Uncertain"}
                    </div>
                    <div className="cert-a-detail">{ca.concerns !== "none" ? ca.concerns : ""}</div>
                    <div className="cert-a-align">{ca.cvAlignment}</div>
                  </div>
                ))}
              </div>
            </Collapsible>
          )}

          {/* Recommendations */}
          {fraud?.recommendations?.length > 0 && (
            <Collapsible title="Recommended Actions" icon="📋">
              <ol className="reco-list">
                {fraud.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ol>
            </Collapsible>
          )}

          {/* Matching reasoning */}
          <div className="match-reason">
            <span className="match-reason-label">Match reasoning:</span> {matchReasoning}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Unmatched certs ──────────────────────────────────────────
function UnmatchedCerts({ result }) {
  return (
    <div className="unmatched-card">
      <div className="unmatched-header">⚠ Unmatched Certificates ({result.certificates.length})</div>
      <p className="unmatched-sub">These certificates could not be matched to any uploaded CV.</p>
      <div className="certs-list">
        {result.certificates.map((c, i) => (
          <div key={i} className="cert-row">
            <span className="cert-icon">🎓</span>
            <div>
              <div className="cert-name">{c.identity?.certificationTitle || c.filename}</div>
              <div className="cert-meta">
                {c.identity?.candidateName ? `Name on cert: ${c.identity.candidateName}` : "No name found"}
                {c.identity?.issuingBody ? ` · ${c.identity.issuingBody}` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Progress tracker ─────────────────────────────────────────
function ProgressTracker({ stage, count }) {
  const current = STAGES.findIndex(s => s.id === stage);
  return (
    <div className="progress-wrap">
      <div className="progress-stages">
        {STAGES.map((s, i) => (
          <div key={s.id} className={`progress-stage ${i < current ? "done" : i === current ? "active" : "pending"}`}>
            <div className="stage-dot">{i < current ? "✓" : s.icon}</div>
            <div className="stage-label">{s.label}</div>
          </div>
        ))}
      </div>
      {count && <div className="progress-count">{count}</div>}
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────
export default function App() {
  const [cvFiles, setCvFiles] = useState([]);
  const [certFiles, setCertFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(null);
  const [stageMsg, setStageMsg] = useState("");
  const [results, setResults] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("ALL");

  const handleRun = async () => {
    if (cvFiles.length === 0) { setError("Upload at least one CV to continue."); return; }
    setError(null);
    setLoading(true);
    setResults(null);
    setSummary(null);

    const stages = [
      { id: "extract",  msg: `Extracting text from ${cvFiles.length + certFiles.length} documents…` },
      { id: "identify", msg: "Identifying candidates in each document…" },
      { id: "match",    msg: "Matching certificates to CVs…" },
      { id: "analyze",  msg: `Running fraud analysis on ${cvFiles.length} candidate${cvFiles.length > 1 ? "s" : ""}…` },
    ];

    // Fake stage ticks so the user sees progress
    let stageIdx = 0;
    const tick = setInterval(() => {
      if (stageIdx < stages.length) {
        setStage(stages[stageIdx].id);
        setStageMsg(stages[stageIdx].msg);
        stageIdx++;
      }
    }, 3200);

    try {
      const form = new FormData();
      cvFiles.forEach(f => form.append("cvs", f));
      certFiles.forEach(f => form.append("certificates", f));

      const res = await axios.post("http://localhost:3001/api/process", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300000, // 5 min for large batches
      });

      clearInterval(tick);
      setStage("done");
      setResults(res.data.results);
      setSummary(res.data.summary);
    } catch (err) {
      clearInterval(tick);
      setError(err.response?.data?.error || err.message || "Processing failed.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResults(null); setSummary(null); setStage(null);
    setCvFiles([]); setCertFiles([]); setError(null);
  };

  const filtered = results?.filter(r => {
    if (r.type === "UNMATCHED_CERT") return filter === "ALL" || filter === "UNMATCHED";
    if (filter === "ALL") return true;
    if (filter === "UNMATCHED") return false;
    return r.fraud?.riskLevel === filter;
  });

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-icon">🔍</div>
            <div>
              <div className="brand-name">Batch CV Validator</div>
              <div className="brand-sub">Persowerk Deutschland GmbH</div>
            </div>
          </div>
          {results && (
            <button className="new-batch-btn" onClick={reset}>← New Batch</button>
          )}
        </div>
      </header>

      <main className="main">

        {/* ── Upload screen ── */}
        {!loading && !results && (
          <div className="upload-screen">
            <div className="upload-intro">
              <h1>Bulk Fraud Detection</h1>
              <p>Upload all your CVs and certificates. The AI will automatically match each certificate to its candidate and flag fraud risks.</p>
            </div>

            <div className="upload-grid">
              <FileDropZone
                label="CVs / Resumes"
                accepts=".pdf,.docx,.txt,.jpg,.jpeg,.png"
                files={cvFiles}
                onFiles={setCvFiles}
                fieldName="cvs"
              />
              <FileDropZone
                label="Certificates & Diplomas"
                accepts=".pdf,.docx,.txt,.jpg,.jpeg,.png"
                files={certFiles}
                onFiles={setCertFiles}
                fieldName="certificates"
              />
            </div>

            <div className="how-it-works">
              <div className="hiw-step"><span>1</span> Upload all CVs and all certificates (names optional on certs)</div>
              <div className="hiw-step"><span>2</span> AI extracts names, skills, and content from every document</div>
              <div className="hiw-step"><span>3</span> AI matches each certificate to the right candidate</div>
              <div className="hiw-step"><span>4</span> Full fraud analysis per candidate with risk scores</div>
            </div>

            {error && <div className="error-bar">⚠ {error}</div>}

            <button
              className="run-btn"
              disabled={cvFiles.length === 0}
              onClick={handleRun}
            >
              Analyze {cvFiles.length} CV{cvFiles.length !== 1 ? "s" : ""}
              {certFiles.length > 0 ? ` + ${certFiles.length} Certificate${certFiles.length !== 1 ? "s" : ""}` : ""}
              &nbsp;→
            </button>
          </div>
        )}

        {/* ── Processing screen ── */}
        {loading && (
          <div className="processing-screen">
            <div className="pulse-ring" />
            <div className="proc-title">Processing your batch…</div>
            <div className="proc-msg">{stageMsg}</div>
            <ProgressTracker stage={stage} />
            <div className="proc-note">This may take {cvFiles.length > 5 ? "a few minutes" : "30–60 seconds"} depending on batch size.</div>
          </div>
        )}

        {/* ── Results screen ── */}
        {results && summary && (
          <div className="results-screen">
            <SummaryBar summary={summary} />

            {/* Filter tabs */}
            <div className="filter-tabs">
              {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "UNMATCHED"].map(f => {
                const cnt = f === "ALL" ? results.filter(r => r.type === "CANDIDATE").length
                  : f === "UNMATCHED" ? results.filter(r => r.type === "UNMATCHED_CERT").length
                  : results.filter(r => r.fraud?.riskLevel === f).length;
                return (
                  <button
                    key={f}
                    className={`filter-tab ${filter === f ? "active" : ""}`}
                    style={filter === f && RISK_COLOR[f] ? { borderColor: RISK_COLOR[f], color: RISK_COLOR[f] } : {}}
                    onClick={() => setFilter(f)}
                  >
                    {f} <span className="tab-count">{cnt}</span>
                  </button>
                );
              })}
            </div>

            {/* Cards */}
            <div className="cards-list">
              {filtered?.map((r, i) => (
                r.type === "UNMATCHED_CERT"
                  ? <UnmatchedCerts key={i} result={r} />
                  : <CandidateCard key={i} result={r} />
              ))}
              {filtered?.length === 0 && (
                <div className="empty-filter">No candidates in this category.</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
