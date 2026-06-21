import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";

const EXPERIENCE_LEVELS = ["Junior (0–2 yrs)", "Mid-level (2–5 yrs)", "Senior (5+ yrs)", "Lead / Manager"];

function App() {
  const [step, setStep] = useState("form"); // form | questions | analyze
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [experienceLevel, setExperienceLevel] = useState(EXPERIENCE_LEVELS[1]);
  const [focusAreas, setFocusAreas] = useState("");

  // Results
  const [questionsResult, setQuestionsResult] = useState("");

  // Analyze answer state
  const [analyzeQuestion, setAnalyzeQuestion] = useState("");
  const [candidateAnswer, setCandidateAnswer] = useState("");
  const [analyzeResult, setAnalyzeResult] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  async function handleGenerateQuestions(e) {
    e.preventDefault();
    if (!jobTitle.trim() || !jobDescription.trim()) {
      setError("Please fill in the job title and description.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle, jobDescription, experienceLevel, focusAreas }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setQuestionsResult(data.result);
      setStep("questions");
    } catch (err) {
      setError("Something went wrong: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyzeAnswer(e) {
    e.preventDefault();
    if (!analyzeQuestion.trim() || !candidateAnswer.trim()) {
      setError("Please fill in both the question and the candidate's answer.");
      return;
    }
    setError("");
    setAnalyzing(true);
    setAnalyzeResult("");
    try {
      const res = await fetch("/api/analyze-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle, question: analyzeQuestion, candidateAnswer }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnalyzeResult(data.result);
    } catch (err) {
      setError("Something went wrong: " + err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-mark">◆</span>
            <span className="logo-text">Interview Copilot</span>
          </div>
          <p className="logo-sub">by Jobs&Joy · for Kohlpharma GmbH</p>
        </div>
      </header>

      <main className="main">
        {/* NAV TABS */}
        {step !== "form" && (
          <div className="tabs">
            <button className={`tab ${step === "questions" ? "active" : ""}`} onClick={() => { setStep("questions"); setError(""); }}>
              📋 Interview Guide
            </button>
            <button className={`tab ${step === "analyze" ? "active" : ""}`} onClick={() => { setStep("analyze"); setError(""); }}>
              🔍 Analyze Answer
            </button>
            <button className="tab tab-back" onClick={() => { setStep("form"); setQuestionsResult(""); setAnalyzeResult(""); setError(""); }}>
              ← New Role
            </button>
          </div>
        )}

        {/* STEP 1: FORM */}
        {step === "form" && (
          <div className="card">
            <div className="card-header">
              <h1>Generate Your Interview Guide</h1>
              <p>Paste in the job details below. We'll create a full interview kit — questions, what to listen for, and red flags to watch out for.</p>
            </div>

            <form onSubmit={handleGenerateQuestions} className="form">
              <div className="field">
                <label>Job Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Data Engineer"
                  value={jobTitle}
                  onChange={e => setJobTitle(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Experience Level</label>
                <div className="radio-group">
                  {EXPERIENCE_LEVELS.map(l => (
                    <label key={l} className={`radio-option ${experienceLevel === l ? "selected" : ""}`}>
                      <input type="radio" name="level" value={l} checked={experienceLevel === l} onChange={() => setExperienceLevel(l)} />
                      {l}
                    </label>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Job Description *</label>
                <textarea
                  rows={7}
                  placeholder="Paste the full job description here, or describe what the person will be doing day-to-day..."
                  value={jobDescription}
                  onChange={e => setJobDescription(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Any specific focus areas? <span className="optional">(optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. cloud infrastructure, team leadership, data pipelines"
                  value={focusAreas}
                  onChange={e => setFocusAreas(e.target.value)}
                />
              </div>

              {error && <div className="error">{error}</div>}

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (
                  <><span className="spinner" /> Generating your guide...</>
                ) : (
                  "Generate Interview Guide →"
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: QUESTIONS */}
        {step === "questions" && (
          <div className="card">
            <div className="card-header">
              <div className="role-badge">{jobTitle} · {experienceLevel}</div>
              <h1>Your Interview Guide</h1>
              <p>These questions and tips are tailored to the role. Use the <strong>Analyze Answer</strong> tab during or after the interview to check a candidate's response.</p>
            </div>
            <div className="markdown-body">
              <ReactMarkdown>{questionsResult}</ReactMarkdown>
            </div>
            <div className="card-footer">
              <button className="btn-secondary" onClick={() => { setStep("analyze"); setError(""); }}>
                🔍 Analyze a Candidate's Answer →
              </button>
              <button className="btn-ghost" onClick={() => window.print()}>
                🖨️ Print / Save as PDF
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: ANALYZE */}
        {step === "analyze" && (
          <div className="card">
            <div className="card-header">
              <div className="role-badge">{jobTitle}</div>
              <h1>Analyze a Candidate's Answer</h1>
              <p>Type or paste what the candidate said. We'll tell you what's good, what's concerning, and what to ask next.</p>
            </div>

            <form onSubmit={handleAnalyzeAnswer} className="form">
              <div className="field">
                <label>Question you asked</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Can you describe how you've handled a production outage?"
                  value={analyzeQuestion}
                  onChange={e => setAnalyzeQuestion(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Candidate's answer</label>
                <textarea
                  rows={5}
                  placeholder="Type or paste what the candidate said..."
                  value={candidateAnswer}
                  onChange={e => setCandidateAnswer(e.target.value)}
                />
              </div>

              {error && <div className="error">{error}</div>}

              <button type="submit" className="btn-primary" disabled={analyzing}>
                {analyzing ? (
                  <><span className="spinner" /> Analyzing...</>
                ) : (
                  "Analyze Answer →"
                )}
              </button>
            </form>

            {analyzeResult && (
              <div className="analyze-result">
                <h2>Analysis</h2>
                <div className="markdown-body">
                  <ReactMarkdown>{analyzeResult}</ReactMarkdown>
                </div>
                <button className="btn-ghost" onClick={() => { setAnalyzeQuestion(""); setCandidateAnswer(""); setAnalyzeResult(""); }}>
                  Analyze another answer
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="footer">
        Powered by Jobs&Joy · Interview Copilot for Kohlpharma GmbH · Confidential
      </footer>
    </div>
  );
}

export default App;
