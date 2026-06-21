/**
 * app.js — UI state, rendering, interactions
 * Globus Group Invoice Agent — fully autonomous (no manual approve/reject)
 *
 * API key is managed securely in .env on the server.
 * No key entry UI is needed in the browser.
 */

const state = {
  invoices:      [],
  selectedId:    null,
  currentView:   'inbox',
  uploadedFiles: [],
  processing:    false
};

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.addEventListener('click', () => switchView(el.dataset.view));
  });
  document.getElementById('file-input').addEventListener('change', e => {
    Array.from(e.target.files).forEach(f => {
      if (!state.uploadedFiles.find(x => x.name === f.name)) state.uploadedFiles.push(f);
    });
    renderFileChips();
    e.target.value = '';
  });
  document.getElementById('process-btn').addEventListener('click', startProcessing);
  setAgentStatus('ready', 'Agents ready');
  renderContent();
  updateBadges();
});

// ─── Processing ───────────────────────────────────────────────────────────────

async function startProcessing() {
  if (state.processing) return;
  const pastedText = document.getElementById('email-text').value.trim();
  if (!state.uploadedFiles.length && !pastedText) {
    showToast('No input', 'Upload a file or paste email text first.'); return;
  }

  state.processing = true;
  document.getElementById('process-btn').disabled = true;
  setAgentStatus('running', 'Agents running…');

  const inputs = [...state.uploadedFiles];
  if (pastedText) inputs.push({ name: 'pasted-email.txt', _pasted: true });
  if (!inputs.length) { state.processing = false; document.getElementById('process-btn').disabled = false; return; }

  const placeholders = inputs.map((f, i) => {
    const ph = {
      id: 'INV-' + Date.now() + i, status: 'processing',
      vendor: f.name || 'Pasted text', amount: '…', dept: null, confidence: 0,
      trace: [], extracted: {}, classification: {}, poResult: {}, routing: {}, decision: {}
    };
    state.invoices.unshift(ph);
    return ph;
  });
  state.selectedId = placeholders[0].id;
  switchView('inbox');
  renderContent();

  try {
    const results = await runPipeline(
      state.uploadedFiles, pastedText,
      (stage, status, msg, sourceIndex) => {
        const ph = placeholders[sourceIndex ?? 0] || placeholders[0];
        const icons = { ingest:'📥', extract:'🔍', classify:'🏷', po:'📋', decision:'🤖', route:'📤' };
        const sIcon = status === 'done' ? '✅' : status === 'warn' ? '⚠️' : status === 'error' ? '❌' : '⏳';
        ph.trace.push({ icon: sIcon, text: `<strong>${icons[stage] || ''} ${capitalize(stage)}:</strong> ${msg}` });
        renderContent();
        updateBadges();
      }
    );

    results.invoices.forEach((inv, i) => {
      const ph = placeholders[i];
      if (!ph) return;
      Object.assign(ph, {
        status:         inv.routing.status,
        vendor:         inv.extracted.vendor || 'Unknown vendor',
        amount:         inv.extracted.amount || '—',
        dept:           inv.classification.department,
        confidence:     inv.classification.confidence,
        extracted:      inv.extracted,
        classification: inv.classification,
        poResult:       inv.poResult,
        routing:        inv.routing,
        decision:       inv.decision
      });
    });

    state.uploadedFiles = [];
    document.getElementById('email-text').value = '';
    renderFileChips();
    showToast(`${results.invoices.length} invoice(s) processed ✅`, 'All routed to departments');
    setAgentStatus('ready', 'Last run: just now');

  } catch (err) {
    placeholders.forEach(ph => { if (ph.status === 'processing') ph.status = 'error'; });
    showToast('Error', err.message);
    setAgentStatus('error', 'Error — check console');
    console.error(err);
  }

  state.processing = false;
  document.getElementById('process-btn').disabled = false;
  updateBadges();
  renderContent();
}

// ─── Views ────────────────────────────────────────────────────────────────────

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  const titles = {
    inbox:'Email inbox', routed:'Routed', flagged:'Needs review',
    it:'IT department', facilities:'Facilities department', hr:'HR department',
    logistics:'Logistics department', finance:'Finance department'
  };
  document.getElementById('topbar-title').textContent = titles[view] || view;
  renderContent();
}

function getVisibleInvoices() {
  const v = state.currentView;
  if (['it','facilities','hr','logistics','finance'].includes(v)) return state.invoices.filter(i => i.dept === v);
  if (v === 'routed')   return state.invoices.filter(i => i.status === 'approved' || i.status === 'escalated');
  if (v === 'flagged')  return state.invoices.filter(i => i.status === 'flagged' || i.status === 'error');
  return state.invoices;
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderContent() {
  const list    = getVisibleInvoices();
  const content = document.getElementById('main-content');

  if (!list.length) {
    const deptNames = { it:'IT', facilities:'Facilities', hr:'HR', logistics:'Logistics', finance:'Finance' };
    const v = state.currentView;
    const isDept = deptNames[v];
    content.innerHTML = `<div class="empty-msg">${
      isDept
        ? `No invoices routed to ${deptNames[v]} yet.<br><span style="font-size:12px;opacity:.7">Invoices classified as ${deptNames[v]} will appear here after processing.</span>`
        : 'No invoices here yet. Upload one below to begin.'
    }</div>`;
    return;
  }

  const sel = list.find(i => i.id === state.selectedId) || list[0];
  if (sel) state.selectedId = sel.id;

  content.innerHTML = `
    <div class="two-col">
      <div class="invoice-list">${list.map(inv => renderCard(inv, inv.id === state.selectedId)).join('')}</div>
      <div>${sel ? renderDetail(sel) : ''}</div>
    </div>`;

  document.querySelectorAll('.inv-card[data-id]').forEach(el => {
    el.addEventListener('click', () => { state.selectedId = el.dataset.id; renderContent(); });
  });
}

function renderCard(inv, selected) {
  const iconMap  = { it:'💻', facilities:'🏢', hr:'👥', logistics:'🚚', finance:'💰', unknown:'❓' };
  const colorMap = { it:'purple', facilities:'teal', hr:'amber', logistics:'blue', finance:'teal', unknown:'coral' };
  const [tagClass, tagLabel] = statusTag(inv);
  const cl = inv.classification || {};
  return `
    <div class="inv-card ${selected ? 'selected' : ''}" data-id="${inv.id}">
      <div class="inv-icon ${colorMap[inv.dept] || 'purple'}">${iconMap[inv.dept] || '📄'}</div>
      <div class="inv-meta">
        <div class="inv-vendor">${esc(inv.vendor || 'Processing…')}</div>
        <div class="inv-detail">${esc(cl.category || inv.id)} · ${esc(inv.extracted?.invoiceDate || '—')}</div>
      </div>
      <div class="inv-right">
        <div class="inv-amount">${esc(inv.amount || '—')}</div>
        <div class="tag ${tagClass}">${tagLabel}</div>
      </div>
    </div>`;
}

function renderDetail(inv) {
  const ex = inv.extracted    || {};
  const cl = inv.classification || {};
  const ro = inv.routing      || {};
  const dc = inv.decision     || {};
  const po = inv.poResult     || {};

  const [tagClass, tagLabel] = statusTag(inv);

  const deptIcon = { it:'💻', facilities:'🏢', hr:'👥', logistics:'🚚', finance:'💰', unknown:'❓' };
  const conf     = cl.confidence || 0;
  const confClass = conf >= 80 ? '' : conf >= 60 ? 'mid' : 'low';

  // Decision banner
  const bannerColors = {
    AUTO_APPROVE: { bg: '#EAF3DE', color: '#3B6D11', icon: '✅' },
    AUTO_FLAG:    { bg: '#FAECE7', color: '#993C1D', icon: '🚨' },
    ESCALATE:     { bg: '#FAEEDA', color: '#854F0B', icon: '⚠️' }
  };
  const bc = bannerColors[dc.decision] || bannerColors.ESCALATE;
  const decisionBanner = dc.decision ? `
    <div style="background:${bc.bg};color:${bc.color};padding:10px 14px;border-radius:8px;font-size:13px;line-height:1.5">
      <strong>${bc.icon} ${dc.decision}</strong> — ${esc(dc.reason || '')}
      ${dc.recommendedAction ? `<div style="margin-top:4px;opacity:.85;font-size:12px">Next: ${esc(dc.recommendedAction)}</div>` : ''}
    </div>` : '';

  // Extracted fields grid
  const fields = [
    ['Vendor',        ex.vendor],
    ['Invoice No',    ex.invoiceNumber],
    ['Invoice Date',  ex.invoiceDate],
    ['Due Date',      ex.dueDate],
    ['Subtotal',      ex.subtotal],
    ['Tax Amount',    ex.taxAmount],
    ['Currency',      ex.currency],
    ['Payment Terms', ex.paymentTerms],
    ['IBAN',          ex.iban],
    ['BIC',           ex.bic],
    ['Tax ID',        ex.taxId],
    ['PO Reference',  ex.poReference],
    ['Sender Email',  ex.senderEmail],
    ['Vendor Address',ex.vendorAddress],
    ['Notes',         ex.notes]
  ].filter(([, v]) => v);

  const fieldsHTML = fields.map(([label, val]) =>
    `<div class="dp-field"><div class="dp-field-label">${label}</div><div class="dp-field-value">${esc(val)}</div></div>`
  ).join('');

  // Line items table
  const lineItemsHTML = (ex.lineItems && ex.lineItems.length && ex.lineItems[0].description) ? `
    <div>
      <div class="section-title">Line items</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="border-bottom:1px solid var(--border)">
            <th style="padding:7px 10px;text-align:left;font-weight:600;color:var(--text2);border-bottom:1px solid var(--border)">Description</th>
            <th style="padding:7px 10px;text-align:right;font-weight:600;color:var(--text2);border-bottom:1px solid var(--border)">Qty</th>
            <th style="padding:7px 10px;text-align:right;font-weight:600;color:var(--text2);border-bottom:1px solid var(--border)">Unit Price</th>
            <th style="padding:7px 10px;text-align:right;font-weight:600;color:var(--text2);border-bottom:1px solid var(--border)">Total</th>
          </tr>
        </thead>
        <tbody>
          ${ex.lineItems.filter(li => li.description).map((li, idx) => `
            <tr style="${idx % 2 === 1 ? 'background:var(--bg2)' : ''}">
              <td style="padding:7px 10px;color:var(--text)">${esc(li.description || '—')}</td>
              <td style="padding:7px 10px;text-align:right;color:var(--text2)">${esc(li.quantity || '—')}</td>
              <td style="padding:7px 10px;text-align:right;color:var(--text2)">${esc(li.unitPrice || '—')}</td>
              <td style="padding:7px 10px;text-align:right;font-weight:500;color:var(--text)">${esc(li.total || '—')}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '';

  // AI classification section
  const classHTML = `
    <div class="section-title">AI classification</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="dp-field">
        <div class="dp-field-label">Department</div>
        <div class="dp-field-value">${deptIcon[cl.department] || '?'} ${esc((cl.department || '—').toUpperCase())}</div>
      </div>
      <div class="dp-field">
        <div class="dp-field-label">Category</div>
        <div class="dp-field-value">${esc(cl.category || '—')}</div>
      </div>
      <div class="dp-field">
        <div class="dp-field-label">Confidence</div>
        <div class="dp-field-value">${conf}%</div>
        <div class="conf-bar" style="margin-top:5px"><div class="conf-fill ${confClass}" style="width:${conf}%"></div></div>
      </div>
      <div class="dp-field">
        <div class="dp-field-label">Urgency</div>
        <div class="dp-field-value">${esc(cl.urgency || '—')}</div>
      </div>
      <div class="dp-field" style="grid-column:span 2">
        <div class="dp-field-label">Reasoning</div>
        <div class="dp-field-value">${esc(cl.reasoning || '—')}</div>
      </div>
      <div class="dp-field" style="grid-column:span 2">
        <div class="dp-field-label">Routed to</div>
        <div class="dp-field-value">${ro.contact ? esc(ro.contact.contact) + ' · ' + esc(ro.contact.email) : '—'}</div>
      </div>
    </div>`;

  // Flags
  const allFlags = ro.allFlags || [];
  const flagsHTML = allFlags.length ? `
    <div class="section-title">Flags</div>
    <div style="display:flex;flex-direction:column;gap:4px">
      ${allFlags.map(f => `<div style="font-size:12px;color:#993C1D;background:#FAECE7;padding:6px 10px;border-radius:6px">⚠ ${esc(f)}</div>`).join('')}
    </div>` : '';

  // Audit note
  const auditHTML = dc.auditNote ? `
    <div class="section-title">Audit trail</div>
    <div style="font-size:12px;color:var(--text2);background:var(--bg2);padding:10px 12px;border-radius:8px;line-height:1.6">${esc(dc.auditNote)}</div>` : '';

  // Agent trace
  const traceHTML = (inv.trace || []).length ? `
    <div class="agent-trace">
      <div class="trace-title">🤖 Agent trace</div>
      ${inv.trace.map(t => `<div class="trace-step"><div class="trace-icon done">${t.icon}</div><div class="trace-text">${t.text}</div></div>`).join('')}
    </div>` : '';

  // Email preview
  const emailHTML = ro.emailBody ? `
    <div class="section-title">📧 Notification sent to department</div>
    <div class="streaming-box">${esc(ro.emailBody)}</div>` : '';

  return `
    <div class="detail-panel">
      <div class="dp-header">
        <div class="inv-icon ${inv.dept || 'purple'}" style="width:40px;height:40px;font-size:20px;border-radius:10px">${deptIcon[inv.dept] || '📄'}</div>
        <div style="flex:1;min-width:0">
          <div class="dp-title">${esc(inv.vendor || 'Processing…')}</div>
          <div class="dp-sub">${esc(inv.id)} &nbsp;<span class="tag ${tagClass}">${tagLabel}</span></div>
        </div>
        <div class="dp-amount">${esc(inv.amount || '—')}</div>
      </div>

      ${decisionBanner}

      <div class="section-title">Extracted invoice data</div>
      <div class="dp-fields">${fieldsHTML}</div>

      ${lineItemsHTML}
      ${classHTML}
      ${flagsHTML}
      ${auditHTML}
      ${traceHTML}
      ${emailHTML}
    </div>`;
}

// ─── File chips ───────────────────────────────────────────────────────────────

function renderFileChips() {
  const area = document.getElementById('file-chips-area');
  area.innerHTML = '';
  if (!state.uploadedFiles.length) return;
  const chips = document.createElement('div');
  chips.className = 'file-chips';
  state.uploadedFiles.forEach((f, i) => {
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.innerHTML = `📎 ${esc(f.name)} <span class="remove" title="Remove">✕</span>`;
    chip.querySelector('.remove').addEventListener('click', () => {
      state.uploadedFiles.splice(i, 1); renderFileChips();
    });
    chips.appendChild(chip);
  });
  area.appendChild(chips);
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function updateBadges() {
  const routed  = state.invoices.filter(i => i.status === 'approved' || i.status === 'escalated');
  const flagged = state.invoices.filter(i => i.status === 'flagged' || i.status === 'error');

  document.getElementById('badge-inbox').textContent   = state.invoices.length;
  document.getElementById('badge-routed').textContent  = routed.length;
  document.getElementById('badge-flagged').textContent = flagged.length;

  ['it','facilities','hr','logistics','finance'].forEach(dept => {
    const el = document.getElementById('badge-' + dept);
    if (!el) return;
    const count = state.invoices.filter(i => i.dept === dept && i.status !== 'processing').length;
    el.textContent = count;
    el.style.display = count > 0 ? '' : 'none';
  });
}

// ─── Toast ────────────────────────────────────────────────────────────────────

let toastTimer = null;
function showToast(title, body) {
  let toast = document.querySelector('.toast');
  if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; document.body.appendChild(toast); }
  toast.innerHTML = `<div class="toast-title">${esc(title)}</div><div class="toast-body">${esc(body)}</div>`;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function setAgentStatus(st, text) {
  const pill = document.getElementById('agent-status');
  pill.className = 'agent-pill' + (st === 'running' ? ' running' : st === 'error' ? ' error' : '');
  pill.innerHTML = `<span class="dot"></span> ${esc(text)}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusTag(inv) {
  const statusMap = {
    approved:   ['tag-approved',   '✅ Auto-approved'],
    flagged:    ['tag-flagged',    '🚨 Flagged'],
    escalated:  ['tag-escalated',  '⚠️ Escalated'],
    processing: ['tag-processing', 'Processing…'],
    error:      ['tag-flagged',    'Error']
  };
  if (statusMap[inv.status]) return statusMap[inv.status];
  return ['tag-' + (inv.dept || 'it'), (inv.dept || 'IT').toUpperCase()];
}

function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
