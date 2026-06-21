import React, { useState, useRef, useCallback } from "react";
import "./App.css";

function ConfidenceBar({ value }) {
  const color =
    value >= 80 ? "#22c55e" : value >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="confidence-bar-wrap">
      <div className="confidence-bar-track">
        <div
          className="confidence-bar-fill"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="confidence-label" style={{ color }}>
        {value}%
      </span>
    </div>
  );
}

function StatusBadge({ isWorkPermit, isExpired }) {
  if (!isWorkPermit) {
    return <span className="badge badge-invalid">✗ Not a Work Permit</span>;
  }
  if (isExpired) {
    return <span className="badge badge-expired">⚠ Permit Expired</span>;
  }
  return <span className="badge badge-valid">✓ Valid Work Permit</span>;
}

function ResultCard({ data }) {
  const { result, filename } = data;
  const {
    isWorkPermit,
    confidence,
    validUntil,
    isExpired,
    permitType,
    issuingCountry,
    holderName,
    documentNumber,
    summary,
    keyFindings,
  } = result;

  return (
    <div className={`result-card ${isWorkPermit ? (isExpired ? "expired" : "valid") : "invalid"}`}>
      <div className="result-header">
        <div className="result-header-left">
          <div className="file-icon">📄</div>
          <div>
            <div className="result-filename">{filename}</div>
            <StatusBadge isWorkPermit={isWorkPermit} isExpired={isExpired} />
          </div>
        </div>
        <div className="result-confidence">
          <div className="confidence-title">AI Confidence</div>
          <ConfidenceBar value={confidence} />
        </div>
      </div>

      <div className="result-body">
        {isWorkPermit && (
          <div className="result-grid">
            <div className="result-field">
              <span className="field-label">Valid Until</span>
              <span className={`field-value ${isExpired ? "expired-date" : "valid-date"}`}>
                {validUntil || "Not found"}
                {isExpired && validUntil && " (EXPIRED)"}
              </span>
            </div>
            {permitType && (
              <div className="result-field">
                <span className="field-label">Permit Type</span>
                <span className="field-value">{permitType}</span>
              </div>
            )}
            {issuingCountry && (
              <div className="result-field">
                <span className="field-label">Issuing Country</span>
                <span className="field-value">{issuingCountry}</span>
              </div>
            )}
            {holderName && (
              <div className="result-field">
                <span className="field-label">Permit Holder</span>
                <span className="field-value">{holderName}</span>
              </div>
            )}
            {documentNumber && (
              <div className="result-field">
                <span className="field-label">Document Number</span>
                <span className="field-value mono">{documentNumber}</span>
              </div>
            )}
          </div>
        )}

        <div className="result-summary">
          <div className="field-label">Analysis</div>
          <p>{summary}</p>
        </div>

        {keyFindings && keyFindings.length > 0 && (
          <div className="result-findings">
            <div className="field-label">Key Findings</div>
            <ul>
              {keyFindings.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [dragging, setDragging] = useState(false);
  const [results, setResults] = useState([]);
  const [processing, setProcessing] = useState([]);
  const [error, setError] = useState(null);
  const fileInputRef = useRef();

  const processFile = useCallback(async (file) => {
    if (file.type !== "application/pdf") {
      setError(`"${file.name}" is not a PDF. Only PDF files are supported.`);
      return;
    }

    const id = Date.now() + Math.random();
    setProcessing((prev) => [...prev, { id, name: file.name }]);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("permit", file);

      const response = await fetch("/api/validate", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Validation failed");
      }

      setResults((prev) => [data, ...prev]);
    } catch (err) {
      setError(`Failed to process "${file.name}": ${err.message}`);
    } finally {
      setProcessing((prev) => prev.filter((p) => p.id !== id));
    }
  }, []);

  const handleFiles = useCallback(
    (files) => {
      Array.from(files).forEach(processFile);
    },
    [processFile]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onFileChange = (e) => {
    handleFiles(e.target.files);
    e.target.value = "";
  };

  const clearAll = () => {
    setResults([]);
    setError(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo-area">
            <div className="logo-mark">LP</div>
            <div>
              <div className="company-name">Leistenschneider</div>
              <div className="company-sub">Personaldienstleistungen GmbH</div>
            </div>
          </div>
          <div className="header-tool-name">Work Permit Validator</div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          <div className="page-intro">
            <h1>Work Permit Validation</h1>
            <p>
              Upload PDF work permit documents for instant AI-powered validation.
              The system checks authenticity, extracts validity dates, and gives you a confidence score.
            </p>
          </div>

          <div
            className={`drop-zone ${dragging ? "dragging" : ""}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf"
              multiple
              onChange={onFileChange}
              style={{ display: "none" }}
            />
            <div className="drop-icon">⬆</div>
            <div className="drop-title">Drop PDF files here</div>
            <div className="drop-sub">or click to browse — multiple files supported</div>
          </div>

          {error && (
            <div className="error-banner">
              <span>⚠</span> {error}
              <button onClick={() => setError(null)}>✕</button>
            </div>
          )}

          {processing.length > 0 && (
            <div className="processing-list">
              {processing.map((p) => (
                <div key={p.id} className="processing-item">
                  <div className="spinner" />
                  <span>Analysing <strong>{p.name}</strong>…</span>
                </div>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div className="results-section">
              <div className="results-header">
                <h2>Results <span className="result-count">{results.length}</span></h2>
                <button className="clear-btn" onClick={clearAll}>Clear all</button>
              </div>
              <div className="results-list">
                {results.map((r, i) => (
                  <ResultCard key={i} data={r} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <div className="container">
          AI-assisted validation — always confirm with original documents for critical decisions.
          Powered by Google Gemini.
        </div>
      </footer>
    </div>
  );
}
