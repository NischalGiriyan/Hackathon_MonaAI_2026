require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3001;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY || GEMINI_API_KEY === "your_gemini_api_key_here") {
  console.error("❌  GEMINI_API_KEY is not set. Add it to backend/.env and restart.");
  process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: "50mb" }));

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "image/jpeg",
      "image/png",
      "image/jpg",
    ];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error(`Unsupported: ${file.mimetype}`));
  },
});

// ── text extraction ──────────────────────────────────────────

async function extractText(file) {
  const { mimetype, path: fp, originalname } = file;
  try {
    if (mimetype === "text/plain") {
      return { text: fs.readFileSync(fp, "utf8"), isImage: false };
    }
    if (mimetype === "application/pdf") {
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(fs.readFileSync(fp));
      const text = data.text?.trim();
      if (text && text.length > 30) return { text, isImage: false };
      // Scanned PDF — treat as image
      return { base64: fs.readFileSync(fp).toString("base64"), mimeType: mimetype, isImage: true };
    }
    if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ path: fp });
      return { text: result.value, isImage: false };
    }
    if (["image/jpeg", "image/png", "image/jpg"].includes(mimetype)) {
      return { base64: fs.readFileSync(fp).toString("base64"), mimeType: mimetype, isImage: true };
    }
  } catch (e) {
    console.error(`Extraction error for ${originalname}:`, e.message);
  }
  return { text: "", isImage: false };
}

// ── Gemini call ──────────────────────────────────────────────

async function callGemini(prompt, imagePayload = null) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const parts = [];
  if (imagePayload) {
    parts.push({ inlineData: { mimeType: imagePayload.mimeType, data: imagePayload.base64 } });
  }
  parts.push({ text: prompt });

  const res = await axios.post(
    url,
    { contents: [{ parts }], generationConfig: { temperature: 0.1, maxOutputTokens: 8192 } },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data.candidates[0].content.parts[0].text;
}

function cleanJson(raw) {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(cleaned); } catch {
    const m = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Could not parse AI JSON response");
  }
}

// ── Step 1: Extract identity from a single doc ───────────────

async function extractDocIdentity(file, extracted) {
  const prompt = `You are an HR document analyst. Extract key identity and content information from this document.

${extracted.isImage ? "[Document provided as image above]" : `DOCUMENT TEXT:\n---\n${extracted.text}\n---`}

Return ONLY valid JSON (no markdown):
{
  "docType": "CV" | "CERTIFICATE" | "DIPLOMA" | "REFERENCE_LETTER" | "COVER_LETTER" | "UNKNOWN",
  "candidateName": "<full name found, or null if not found>",
  "nameConfidence": "HIGH" | "MEDIUM" | "LOW",
  "keySkills": ["<skill1>", "<skill2>"],
  "certificationTitle": "<if certificate: exact cert name, else null>",
  "issuingBody": "<if certificate: issuing organization, else null>",
  "issueDate": "<if certificate: date issued, else null>",
  "expiryDate": "<if certificate: expiry date, else null>",
  "summary": "<1 sentence about what this document is>"
}`;

  const raw = await callGemini(prompt, extracted.isImage ? extracted : null);
  return cleanJson(raw);
}

// ── Step 2: Match CVs to certificates ───────────────────────

async function matchCVsAndCerts(cvList, certList) {
  const cvSummaries = cvList.map((c, i) => `CV[${i}] filename="${c.originalname}" name="${c.identity.candidateName || "unknown"}" skills=${JSON.stringify(c.identity.keySkills?.slice(0, 5))}`).join("\n");
  const certSummaries = certList.map((c, i) => `CERT[${i}] filename="${c.originalname}" name="${c.identity.candidateName || "NOT FOUND"}" cert="${c.identity.certificationTitle}" issuer="${c.identity.issuingBody}" skills=${JSON.stringify(c.identity.keySkills?.slice(0, 3))}`).join("\n");

  const prompt = `You are an expert HR document matcher. Match certificates to CVs based on candidate names, skills, and context. Some certificates may not have a name — match them based on skills alignment or mark as unmatched.

CVs:
${cvSummaries}

CERTIFICATES:
${certSummaries}

Rules:
- A certificate matches a CV if: names match (exact or close), OR if no name in cert but skills strongly align with a CV
- One certificate can only belong to one CV
- If a cert has no matching CV, mark cvIndex as null
- If a CV has no certificates, it will simply have an empty array

Return ONLY valid JSON array (no markdown):
[
  {
    "cvIndex": <number>,
    "certIndexes": [<numbers>],
    "matchReasoning": "<why these certs were matched to this CV>"
  }
]

Include an entry for every CV. Also include unmatched certs as:
{
  "cvIndex": null,
  "certIndexes": [<number>],
  "matchReasoning": "No matching CV found"
}`;

  const raw = await callGemini(prompt);
  return cleanJson(raw);
}

// ── Step 3: Fraud analysis per candidate ────────────────────

async function analyzeFraud(cv, certs) {
  const cvText = cv.extracted.isImage ? "[CV provided as image]" : (cv.extracted.text || "");
  const certDetails = certs.map((c, i) => {
    const text = c.extracted.isImage ? `[Image cert ${i + 1}]` : (c.extracted.text || "");
    return `--- Certificate ${i + 1} (${c.originalname}) ---\n${text.slice(0, 1500)}`;
  }).join("\n\n");

  const prompt = `You are a senior HR fraud analyst at a German staffing firm. Analyze this candidate's CV and their matched certificates for fraud, inconsistencies, and AI-generation.

CV (${cv.originalname}):
${cvText.slice(0, 3000)}

MATCHED CERTIFICATES (${certs.length} total):
${certDetails || "No certificates matched to this candidate."}

Perform comprehensive fraud analysis. Return ONLY valid JSON (no markdown):
{
  "overallRiskScore": <0-100, higher = more fraud risk>,
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "aiGeneratedProbability": <0-100>,
  "verdict": "<one clear sentence verdict>",
  "certificateMatchQuality": "STRONG" | "PARTIAL" | "WEAK" | "NONE",
  "certificateMatchNote": "<do the certificates actually support the CV claims?>",
  "redFlags": [
    {
      "category": "<e.g. Fake Certificate / AI-Generated CV / Date Inconsistency>",
      "severity": "LOW" | "MEDIUM" | "HIGH",
      "description": "<specific finding>",
      "detail": "<what exactly raises suspicion>"
    }
  ],
  "positiveSignals": ["<things that look authentic>"],
  "cvAnalysis": {
    "workHistoryGaps": "<analysis>",
    "careerProgressionLogic": "<does the career make sense?>",
    "dateConsistency": "<are all dates consistent?>",
    "titleInflation": "<any inflated roles?>"
  },
  "certificateAnalysis": [
    {
      "certName": "<name>",
      "authentic": true | false | null,
      "concerns": "<any specific concerns or 'none'>",
      "cvAlignment": "<does this cert match what CV claims?>"
    }
  ],
  "recommendations": ["<specific action to take with this candidate>"]
}`;

  const raw = await callGemini(prompt, null);
  return cleanJson(raw);
}

// ── Main processing endpoint ─────────────────────────────────

app.post("/api/process", upload.fields([
  { name: "cvs", maxCount: 50 },
  { name: "certificates", maxCount: 100 },
]), async (req, res) => {
  const uploadedFiles = [];

  try {
    const cvFiles = req.files?.cvs || [];
    const certFiles = req.files?.certificates || [];

    if (cvFiles.length === 0) {
      return res.status(400).json({ error: "Please upload at least one CV." });
    }

    // ── Stage 1: Extract text from all files ──────────────────
    console.log(`\n📂 Processing ${cvFiles.length} CVs and ${certFiles.length} certificates...`);

    const allFiles = [...cvFiles, ...certFiles];
    allFiles.forEach(f => uploadedFiles.push(f.path));

    const cvData = [];
    for (const f of cvFiles) {
      const extracted = await extractText(f);
      cvData.push({ ...f, extracted, identity: null });
    }

    const certData = [];
    for (const f of certFiles) {
      const extracted = await extractText(f);
      certData.push({ ...f, extracted, identity: null });
    }

    // ── Stage 2: Extract identity from each doc ───────────────
    console.log("🔍 Extracting identities...");
    for (const cv of cvData) {
      cv.identity = await extractDocIdentity(cv, cv.extracted);
      console.log(`  CV: ${cv.originalname} → ${cv.identity.candidateName || "unknown"}`);
    }
    for (const cert of certData) {
      cert.identity = await extractDocIdentity(cert, cert.extracted);
      console.log(`  Cert: ${cert.originalname} → ${cert.identity.candidateName || "no name"} | ${cert.identity.certificationTitle || "unknown cert"}`);
    }

    // ── Stage 3: Match certs to CVs ───────────────────────────
    let matches = [];
    if (certData.length > 0) {
      console.log("🔗 Matching certificates to CVs...");
      matches = await matchCVsAndCerts(cvData, certData);
    } else {
      matches = cvData.map((_, i) => ({ cvIndex: i, certIndexes: [], matchReasoning: "No certificates uploaded." }));
    }

    // ── Stage 4: Fraud analysis per candidate ─────────────────
    console.log("🚨 Running fraud analysis...");
    const results = [];

    for (const match of matches) {
      if (match.cvIndex === null) {
        // Unmatched certificates
        results.push({
          type: "UNMATCHED_CERT",
          certificates: match.certIndexes.map(i => ({
            filename: certData[i]?.originalname,
            identity: certData[i]?.identity,
          })),
          matchReasoning: match.matchReasoning,
        });
        continue;
      }

      const cv = cvData[match.cvIndex];
      const matchedCerts = (match.certIndexes || []).map(i => certData[i]).filter(Boolean);

      const fraud = await analyzeFraud(cv, matchedCerts);
      console.log(`  ${cv.identity.candidateName || cv.originalname}: ${fraud.riskLevel} (${fraud.overallRiskScore})`);

      results.push({
        type: "CANDIDATE",
        cvFilename: cv.originalname,
        candidateName: cv.identity.candidateName || "Unknown",
        matchReasoning: match.matchReasoning,
        certificates: matchedCerts.map(c => ({
          filename: c.originalname,
          identity: c.identity,
        })),
        fraud,
      });
    }

    // Sort: highest risk first
    results.sort((a, b) => {
      if (a.type === "UNMATCHED_CERT") return 1;
      if (b.type === "UNMATCHED_CERT") return -1;
      return (b.fraud?.overallRiskScore || 0) - (a.fraud?.overallRiskScore || 0);
    });

    // Summary stats
    const candidates = results.filter(r => r.type === "CANDIDATE");
    const summary = {
      totalCVs: cvData.length,
      totalCertificates: certData.length,
      totalCandidates: candidates.length,
      criticalRisk: candidates.filter(c => c.fraud?.riskLevel === "CRITICAL").length,
      highRisk: candidates.filter(c => c.fraud?.riskLevel === "HIGH").length,
      mediumRisk: candidates.filter(c => c.fraud?.riskLevel === "MEDIUM").length,
      lowRisk: candidates.filter(c => c.fraud?.riskLevel === "LOW").length,
    };

    res.json({ success: true, summary, results });

  } catch (err) {
    console.error("Processing error:", err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  } finally {
    // Cleanup temp files
    uploadedFiles.forEach(fp => { try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {} });
  }
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`\n🔍 CV Matcher backend on http://localhost:${PORT}`);
});
