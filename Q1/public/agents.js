/**
 * agents.js — Multi-Agent Invoice Processing Pipeline
 * Globus Group · St. Wendel
 *
 * Agents:
 *  1. IngestorAgent   — reads PDF / DOCX / PNG / JPG / pasted text
 *  2. ExtractorAgent  — calls Gemini to OCR & extract structured fields
 *  3. ClassifierAgent — calls Gemini to classify department & confidence
 *  4. POMatcherAgent  — simulates ERP PO lookup
 *  5. DecisionAgent   — AI makes final approve/flag/escalate decision (NO human needed)
 *  6. RouterAgent     — composes notification email & sets final status
 *
 * API key is stored securely in .env on the server — never in the browser.
 * All Gemini calls go through the /api/gemini proxy endpoint.
 */

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Calls the server-side Gemini proxy.
 * The API key never touches the browser.
 */
async function geminiGenerate(prompt, imageBase64, mimeType) {
  const body = { prompt };
  if (imageBase64 && mimeType) {
    body.imageBase64 = imageBase64;
    body.mimeType    = mimeType;
  }

  const res = await fetch('/api/gemini', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Server error ${res.status}`);
  }

  const data = await res.json();
  return data.text || '';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

function parseJSON(raw) {
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

// ─── Agent 1 · Ingestor ───────────────────────────────────────────────────────

const IngestorAgent = {
  name: 'Ingestor',
  async run(files, pastedText) {
    const sources = [];
    for (const file of files) {
      if (file.name.toLowerCase().endsWith('.docx')) {
        const text = await extractDocxText(file);
        sources.push({ name: file.name, mimeType: 'text/plain', text, size: file.size, type: 'docx' });
      } else {
        const base64 = await fileToBase64(file);
        sources.push({ name: file.name, mimeType: file.type, base64, size: file.size, type: 'binary' });
      }
    }
    if (pastedText.trim()) {
      sources.push({ name: 'pasted-email.txt', mimeType: 'text/plain', text: pastedText.trim(), type: 'text' });
    }
    if (!sources.length) throw new Error('No input provided — upload a file or paste email text.');
    return sources;
  }
};

// ─── Agent 2 · Extractor ──────────────────────────────────────────────────────

const ExtractorAgent = {
  name: 'Extractor',
  async run(source) {
    const prompt = `You are an invoice data extraction specialist for Globus Group in St. Wendel, Germany.
Extract ALL available fields from this invoice and return ONLY valid JSON (no markdown fences, no explanation).

{
  "vendor": string,
  "vendorAddress": string,
  "invoiceNumber": string,
  "invoiceDate": string,
  "dueDate": string,
  "amount": string,
  "currency": string,
  "taxAmount": string,
  "subtotal": string,
  "lineItems": [
    { "description": string, "quantity": string, "unitPrice": string, "total": string }
  ],
  "poReference": string,
  "iban": string,
  "bic": string,
  "taxId": string,
  "senderEmail": string,
  "paymentTerms": string,
  "notes": string
}

Use null for any field not found. Return ONLY the JSON object.`;

    let raw = '';
    if (source.base64) {
      raw = await geminiGenerate(prompt, source.base64, source.mimeType);
    } else {
      raw = await geminiGenerate(prompt + '\n\nDocument text:\n' + source.text);
    }

    try {
      return parseJSON(raw);
    } catch {
      return { vendor: null, invoiceNumber: null, amount: null, rawText: raw };
    }
  }
};

// ─── Agent 3 · Classifier ─────────────────────────────────────────────────────

const DEPARTMENTS = {
  it:         { label: 'IT',         contact: 'Thomas Müller',  email: 'it@globusgroup.de',         keywords: 'software, hardware, licenses, cloud, SaaS, laptops, servers, network, ERP, SAP, Microsoft, Azure, IT equipment' },
  facilities: { label: 'Facilities', contact: 'Klaus Weber',    email: 'facilities@globusgroup.de', keywords: 'cleaning, HVAC, maintenance, security, building, office supplies, rent, utilities, repairs, plumbing, janitorial' },
  hr:         { label: 'HR',         contact: 'Lisa Schneider', email: 'hr@globusgroup.de',         keywords: 'staffing, recruitment, temp workers, training, payroll, benefits, placement, headhunting, employee services' },
  logistics:  { label: 'Logistics',  contact: 'Markus Bauer',   email: 'logistics@globusgroup.de',  keywords: 'freight, shipping, delivery, transport, warehouse, fleet, vehicles, customs, DHL, UPS, forwarding' },
  finance:    { label: 'Finance',    contact: 'Anna Fischer',   email: 'finance@globusgroup.de',    keywords: 'audit, accounting, tax advisory, legal, insurance, banking fees, financial consulting' }
};

const ClassifierAgent = {
  name: 'Classifier',
  async run(extracted) {
    const deptList = Object.entries(DEPARTMENTS)
      .map(([key, v]) => `- ${key} (${v.label}): ${v.keywords}`).join('\n');

    const prompt = `You are an invoice routing classifier for Globus Group, a company in St. Wendel, Germany.
Analyse this invoice data and classify which internal department should handle it.

Departments:
${deptList}

Invoice data:
${JSON.stringify(extracted, null, 2)}

Return ONLY valid JSON (no markdown):
{
  "department": "it" | "facilities" | "hr" | "logistics" | "finance" | "unknown",
  "confidence": number 0-100,
  "reasoning": string (one clear sentence explaining why),
  "category": string (e.g. "Software License", "Office Maintenance", "Temp Staffing", "Freight Services"),
  "urgency": "low" | "normal" | "high",
  "flags": [string]
}`;

    let raw = await geminiGenerate(prompt);
    try {
      return parseJSON(raw);
    } catch {
      return { department: 'unknown', confidence: 0, reasoning: 'Classification failed', category: 'Unknown', urgency: 'normal', flags: ['Parse error'] };
    }
  }
};

// ─── Agent 4 · PO Matcher ─────────────────────────────────────────────────────

const PO_DATABASE = {
  'PO-2026-0312': { vendor: 'SAP',       dept: 'it',         maxAmount: 15000 },
  'PO-2026-0287': { vendor: 'Bosch',     dept: 'facilities', maxAmount: 5000  },
  'PO-2026-0301': { vendor: 'DHL',       dept: 'logistics',  maxAmount: 8000  },
  'PO-2026-0295': { vendor: 'Lenovo',    dept: 'it',         maxAmount: 12000 },
  'PO-2026-0278': { vendor: 'Securitas', dept: 'facilities', maxAmount: 6000  },
};

const POMatcherAgent = {
  name: 'PO Matcher',
  run(extracted) {
    const po = extracted.poReference;
    if (po && PO_DATABASE[po]) {
      const match      = PO_DATABASE[po];
      const amount     = parseFloat((extracted.amount || '0').replace(/[^0-9.]/g, ''));
      const overBudget = amount > match.maxAmount;
      return {
        matched: true, poNumber: po, poDetails: match, overBudget,
        flags: overBudget ? [`Amount ${extracted.amount} exceeds PO limit €${match.maxAmount}`] : []
      };
    }
    return {
      matched: false, poNumber: po || null,
      flags: po ? [`PO "${po}" not found in ERP`] : ['No PO reference — new vendor or ad-hoc purchase']
    };
  }
};

// ─── Agent 5 · Decision Agent (AI) ───────────────────────────────────────────

const DecisionAgent = {
  name: 'Decision',
  async run(extracted, classification, poResult) {
    const prompt = `You are the autonomous invoice approval agent for Globus Group, St. Wendel.
Your job is to make a final decision on this invoice WITHOUT any human intervention.

You have full authority to:
- AUTO_APPROVE: invoice is valid, data is complete, amounts are reasonable
- AUTO_FLAG: something looks wrong or suspicious — needs Finance team audit
- ESCALATE: genuinely ambiguous, needs a department head call

Rules:
- If confidence >= 80 AND PO matched AND no red flags → AUTO_APPROVE
- If confidence < 60 OR amount looks abnormal OR vendor unrecognised → AUTO_FLAG  
- If confidence 60-79 OR PO missing but vendor is known → ESCALATE
- Always give a short, specific reason

Extracted invoice:
${JSON.stringify(extracted, null, 2)}

Classification result:
${JSON.stringify(classification, null, 2)}

PO match result:
${JSON.stringify(poResult, null, 2)}

Return ONLY valid JSON (no markdown):
{
  "decision": "AUTO_APPROVE" | "AUTO_FLAG" | "ESCALATE",
  "reason": string (one sentence, specific),
  "paymentAuthorised": boolean,
  "auditNote": string (what was checked and why decision was made),
  "recommendedAction": string (what happens next, e.g. "Payment scheduled for due date", "Sent to Finance audit queue")
}`;

    let raw = await geminiGenerate(prompt);
    try {
      return parseJSON(raw);
    } catch {
      return {
        decision: 'ESCALATE',
        reason: 'Could not parse AI decision — escalating to Finance team',
        paymentAuthorised: false,
        auditNote: 'Decision agent parse error',
        recommendedAction: 'Manual review required'
      };
    }
  }
};

// ─── Agent 6 · Router ─────────────────────────────────────────────────────────

const RouterAgent = {
  name: 'Router',
  run(classification, poResult, extracted, decision) {
    const dept    = classification.department;
    const deptCfg = DEPARTMENTS[dept] || DEPARTMENTS.finance;
    const allFlags = [...(classification.flags || []), ...(poResult.flags || [])];

    const statusMap = { AUTO_APPROVE: 'approved', AUTO_FLAG: 'flagged', ESCALATE: 'escalated' };
    const status = statusMap[decision.decision] || 'escalated';

    const emailBody = `Hi ${deptCfg.contact},

The Globus Invoice Agent has processed and made an autonomous decision on the following invoice.

━━━ INVOICE DETAILS ━━━
  Vendor:        ${extracted.vendor || '—'}
  Invoice No:    ${extracted.invoiceNumber || '—'}
  Amount:        ${extracted.amount || '—'} ${extracted.currency || ''}
  Invoice Date:  ${extracted.invoiceDate || '—'}
  Due Date:      ${extracted.dueDate || '—'}
  PO Reference:  ${extracted.poReference || 'None'}
  Category:      ${classification.category || '—'}
  Department:    ${deptCfg.label}

━━━ AI DECISION ━━━
  Decision:      ${decision.decision}
  Reason:        ${decision.reason}
  Payment Auth:  ${decision.paymentAuthorised ? 'YES' : 'NO'}
  Next Step:     ${decision.recommendedAction}

━━━ AUDIT TRAIL ━━━
  ${decision.auditNote}
  Classifier confidence: ${classification.confidence}%
  PO matched: ${poResult.matched ? 'Yes — ' + poResult.poNumber : 'No'}
${allFlags.length ? '\n⚠ FLAGS:\n' + allFlags.map(f => '  · ' + f).join('\n') : ''}

— Globus Invoice Agent (Autonomous)`;

    return { department: dept, contact: deptCfg, status, allFlags, emailBody, decision };
  }
};

// ─── Master Pipeline ──────────────────────────────────────────────────────────

async function runPipeline(files, pastedText, onProgress) {
  const results = { sources: [], invoices: [] };

  onProgress('ingest', 'running', 'Reading input files…', 0);
  results.sources = await IngestorAgent.run(files, pastedText);
  onProgress('ingest', 'done', `${results.sources.length} source(s) loaded`, 0);

  for (let i = 0; i < results.sources.length; i++) {
    const source = results.sources[i];
    const inv = { source, id: 'INV-' + Date.now() + i };

    onProgress('extract', 'running', `Extracting fields from "${source.name}"…`, i);
    inv.extracted = await ExtractorAgent.run(source);
    onProgress('extract', 'done', `Vendor: ${inv.extracted.vendor || '?'} · Amount: ${inv.extracted.amount || '?'}`, i);

    onProgress('classify', 'running', 'Classifying department…', i);
    inv.classification = await ClassifierAgent.run(inv.extracted);
    onProgress('classify', 'done', `${(inv.classification.department || '?').toUpperCase()} · ${inv.classification.category || '?'} · ${inv.classification.confidence}% confidence`, i);

    onProgress('po', 'running', 'Matching PO…', i);
    inv.poResult = POMatcherAgent.run(inv.extracted);
    onProgress('po', inv.poResult.matched ? 'done' : 'warn', inv.poResult.matched ? `PO matched: ${inv.poResult.poNumber}` : 'No PO match', i);

    onProgress('decision', 'running', 'AI making decision…', i);
    inv.decision = await DecisionAgent.run(inv.extracted, inv.classification, inv.poResult);
    const decisionIcon = inv.decision.decision === 'AUTO_APPROVE' ? '✅ AUTO-APPROVED' : inv.decision.decision === 'AUTO_FLAG' ? '🚨 AUTO-FLAGGED' : '⚠️ ESCALATED';
    onProgress('decision', 'done', `${decisionIcon} — ${inv.decision.reason}`, i);

    onProgress('route', 'running', 'Routing…', i);
    inv.routing = RouterAgent.run(inv.classification, inv.poResult, inv.extracted, inv.decision);
    onProgress('route', 'done', `Sent to ${inv.routing.contact.contact} (${inv.routing.contact.label})`, i);

    results.invoices.push(inv);
  }

  return results;
}
