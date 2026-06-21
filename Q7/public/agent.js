// ============================================================
//  Dr. Theiss Analytics Agent — agent.js
//  Handles: data ingestion, RFM, patterns, targeting, lift
// ============================================================

// ── Product Catalogue (§3) ───────────────────────────────────
const PRODUCT_CATALOGUE = [
  { sku:"ALK-FB-01", name:"Fuß Butter",                    line:"Feet",          pack:"100ml",  price:7.71,  peakSeason:"Autumn–Winter",  segment:"45+ dry-skin, women" },
  { sku:"ALK-FB-02", name:"Sole Fußbad",                   line:"Feet",          pack:"400g",   price:6.49,  peakSeason:"Winter",         segment:"Wellness, 50+" },
  { sku:"ALK-FB-03", name:"Hornhaut Reduziercreme",         line:"Feet",          pack:"50ml",   price:6.99,  peakSeason:"Spring",         segment:"Women 30–60" },
  { sku:"ALK-FB-04", name:"Hornhaut Entferner Maske",       line:"Feet",          pack:"2x20ml", price:8.49,  peakSeason:"Spring–Summer",  segment:"Women 25–45" },
  { sku:"ALK-FB-05", name:"10% Urea Fußcreme",              line:"Feet",          pack:"100ml",  price:7.25,  peakSeason:"All year",       segment:"Diabetic / very dry skin" },
  { sku:"ALK-FB-06", name:"Fußpflege Deospray",             line:"Feet",          pack:"75ml",   price:6.10,  peakSeason:"Summer",         segment:"Active / men 20–45" },
  { sku:"ALK-LG-01", name:"5 in 1 Beinlotion",              line:"Legs",          pack:"200ml",  price:9.95,  peakSeason:"Summer",         segment:"Women 35–65" },
  { sku:"ALK-LG-02", name:"Bein Frische Gel",               line:"Legs",          pack:"100ml",  price:8.20,  peakSeason:"Summer",         segment:"Travel / standing jobs" },
  { sku:"ALK-LG-03", name:"Besenreiser Pflegebalsam",        line:"Legs",          pack:"100ml",  price:11.49, peakSeason:"Spring–Summer",  segment:"Women 40–65" },
  { sku:"ALK-MG-01", name:"Mobil Gel",                      line:"Muscles/Joints",pack:"100ml",  price:5.83,  peakSeason:"Autumn–Winter",  segment:"Active 30+, 55+ joints" },
  { sku:"ALK-MG-02", name:"Mobil Einreibung Extra Stark",    line:"Muscles/Joints",pack:"100ml",  price:8.90,  peakSeason:"Winter / sport", segment:"Sport, 25–55" },
  { sku:"ALK-MG-03", name:"Mobil Eisspray akut",             line:"Muscles/Joints",pack:"150ml",  price:9.40,  peakSeason:"Sport season",   segment:"Athletes, teams" },
  { sku:"ALK-MG-04", name:"Franzbranntwein",                 line:"Muscles/Joints",pack:"250ml",  price:6.75,  peakSeason:"All year",       segment:"Traditional 55+" },
  { sku:"ALK-MG-05", name:"Wärmendes Intensiv Gel",          line:"Muscles/Joints",pack:"100ml",  price:8.30,  peakSeason:"Winter",         segment:"45+ tension/back" },
  { sku:"ALK-CB-01", name:"Ur Bonbons",                      line:"Cough Drops",   pack:"75g",    price:2.49,  peakSeason:"Cold season",    segment:"Mass-market" },
];

// ── Synthetic Transactions Generator ────────────────────────
function generateSyntheticTransactions(n = 800) {
  const channels  = ["pharmacy","online","dm","rossmann"];
  const regions   = ["Bayern","Baden-Württemberg","NRW","Hamburg","Hessen","Saarland","Sachsen"];
  const weathers  = ["sunny","cloudy","cold","rainy","hot"];
  const skus      = PRODUCT_CATALOGUE.map(p => p.sku);

  // Season → month weights
  const seasonMonthWeights = {
    "Spring":        [0,0,0,3,4,5,2,0,0,0,0,0],
    "Spring–Summer": [0,0,0,2,4,5,5,4,2,0,0,0],
    "Summer":        [0,0,0,0,2,4,5,5,3,1,0,0],
    "Autumn–Winter": [0,0,0,0,0,0,1,2,4,5,5,4],
    "Winter":        [4,4,0,0,0,0,0,0,0,2,4,5],
    "Winter / sport":[3,3,0,0,0,1,1,1,1,2,3,4],
    "Sport season":  [1,1,2,3,4,5,5,5,4,3,2,1],
    "Cold season":   [5,4,2,1,0,0,0,0,1,2,4,5],
    "All year":      [1,1,1,1,1,1,1,1,1,1,1,1],
  };

  function weightedMonth(product) {
    const w = seasonMonthWeights[product.peakSeason] || seasonMonthWeights["All year"];
    const total = w.reduce((a,b)=>a+b,0);
    let r = Math.random()*total, cum=0;
    for(let i=0;i<12;i++){ cum+=w[i]; if(r<=cum) return i; }
    return 0;
  }

  const txns = [];
  const customerCount = 150;
  const customerIds = Array.from({length:customerCount},(_,i)=>`C${String(i+1).padStart(4,"0")}`);

  for(let i=0; i<n; i++){
    const custId = customerIds[Math.floor(Math.random()*customerCount)];
    const prod   = PRODUCT_CATALOGUE[Math.floor(Math.random()*PRODUCT_CATALOGUE.length)];
    const month  = weightedMonth(prod);
    const year   = Math.random()<0.5 ? 2023 : 2024;
    const day    = Math.floor(Math.random()*28)+1;
    const date   = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const qty    = Math.floor(Math.random()*3)+1;
    const channel= channels[Math.floor(Math.random()*channels.length)];
    const region = regions[Math.floor(Math.random()*regions.length)];
    const weather= weathers[Math.floor(Math.random()*weathers.length)];
    // treatment flag: random 50/50 for lift simulation
    const treatment = Math.random()<0.5 ? 1 : 0;
    // treated customers get small lift in qty
    const finalQty = (treatment===1 && Math.random()<0.3) ? qty+1 : qty;

    txns.push({
      customer_id: custId,
      sku:         prod.sku,
      product:     prod.name,
      line:        prod.line,
      date,
      month:       month+1,
      year,
      qty:         finalQty,
      channel,
      price:       prod.price,
      revenue:     parseFloat((prod.price * finalQty).toFixed(2)),
      weather,
      region,
      treatment,
    });
  }
  return txns;
}

// ── RFM Analysis ─────────────────────────────────────────────
function computeRFM(transactions) {
  const now = new Date("2025-01-01");
  const byCustomer = {};

  transactions.forEach(t => {
    if(!byCustomer[t.customer_id]) byCustomer[t.customer_id] = {orders:[],revenue:0,dates:[]};
    byCustomer[t.customer_id].orders.push(t);
    byCustomer[t.customer_id].revenue += t.revenue;
    byCustomer[t.customer_id].dates.push(new Date(t.date));
  });

  const rfmRows = Object.entries(byCustomer).map(([cid,data])=>{
    const lastDate = new Date(Math.max(...data.dates));
    const recency  = Math.floor((now-lastDate)/(1000*60*60*24));
    const frequency= data.orders.length;
    const monetary = parseFloat(data.revenue.toFixed(2));
    return { customer_id:cid, recency, frequency, monetary };
  });

  // Score 1–5
  const score = (val, arr, asc=true) => {
    const sorted = [...arr].sort((a,b)=>asc?a-b:b-a);
    const pct = sorted.indexOf(val)/sorted.length;
    return Math.min(5,Math.floor(pct*5)+1);
  };
  const recencies   = rfmRows.map(r=>r.recency);
  const frequencies = rfmRows.map(r=>r.frequency);
  const monetaries  = rfmRows.map(r=>r.monetary);

  return rfmRows.map(r=>{
    const R = score(r.recency,   recencies,   true);   // lower recency = better
    const F = score(r.frequency, frequencies, false);  // higher = better
    const M = score(r.monetary,  monetaries,  false);
    const rfmScore = R*100 + F*10 + M;

    let segment;
    if(R>=4&&F>=4&&M>=4) segment="Champions";
    else if(R>=3&&F>=3)  segment="Loyal Customers";
    else if(R>=4&&F<=2)  segment="Recent Customers";
    else if(R<=2&&F>=4)  segment="At Risk";
    else if(R<=2&&F<=2)  segment="Lost / Hibernating";
    else                  segment="Potential Loyalists";

    return { ...r, R, F, M, rfmScore, segment };
  }).sort((a,b)=>b.rfmScore-a.rfmScore);
}

// ── Behavioral Patterns ──────────────────────────────────────
function computePatterns(transactions) {
  // Season distribution per SKU
  const skuMonthMap = {};
  const lineAffinityMap = {};
  const regionMap = {};
  const channelMap = {};
  const weatherMap = {};

  transactions.forEach(t => {
    // SKU x month
    if(!skuMonthMap[t.sku]) skuMonthMap[t.sku] = Array(12).fill(0);
    skuMonthMap[t.sku][t.month-1] += t.qty;

    // Line affinity per customer
    if(!lineAffinityMap[t.customer_id]) lineAffinityMap[t.customer_id]={};
    lineAffinityMap[t.customer_id][t.line] = (lineAffinityMap[t.customer_id][t.line]||0)+t.revenue;

    // Region
    if(!regionMap[t.region]) regionMap[t.region]=0;
    regionMap[t.region] += t.revenue;

    // Channel
    if(!channelMap[t.channel]) channelMap[t.channel]=0;
    channelMap[t.channel] += t.revenue;

    // Weather
    if(!weatherMap[t.weather]) weatherMap[t.weather]={};
    weatherMap[t.weather][t.line] = (weatherMap[t.weather][t.line]||0)+t.revenue;
  });

  // Category affinity: per customer, dominant line
  const affinitySummary = { Feet:0, Legs:0, "Muscles/Joints":0, "Cough Drops":0 };
  Object.values(lineAffinityMap).forEach(lines=>{
    const top = Object.entries(lines).sort((a,b)=>b[1]-a[1])[0];
    if(top) affinitySummary[top[0]] = (affinitySummary[top[0]]||0)+1;
  });

  return { skuMonthMap, lineAffinityMap, affinitySummary, regionMap, channelMap, weatherMap };
}

// ── Targeting Signals ────────────────────────────────────────
function computeTargetingSignals(transactions, rfm) {
  const signals = [];

  // Map rfm segments to customers
  const rfmByCustomer = {};
  rfm.forEach(r => rfmByCustomer[r.customer_id] = r);

  // Group revenue by SKU × month × rfm segment
  const skuSegMonth = {};
  transactions.forEach(t => {
    const r = rfmByCustomer[t.customer_id];
    if(!r) return;
    const key = `${t.sku}||${t.month}||${r.segment}`;
    if(!skuSegMonth[key]) skuSegMonth[key] = {sku:t.sku, month:t.month, segment:r.segment, revenue:0, qty:0};
    skuSegMonth[key].revenue += t.revenue;
    skuSegMonth[key].qty     += t.qty;
  });

  // Month labels
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Top signals: highest revenue combos
  const sorted = Object.values(skuSegMonth).sort((a,b)=>b.revenue-a.revenue).slice(0,30);
  const prodMap = {};
  PRODUCT_CATALOGUE.forEach(p=>prodMap[p.sku]=p);

  sorted.forEach(s=>{
    const prod = prodMap[s.sku];
    if(!prod) return;
    signals.push({
      sku:         s.sku,
      product:     prod.name,
      line:        prod.line,
      segment:     s.segment,
      bestMonth:   monthNames[s.month-1],
      revenue:     parseFloat(s.revenue.toFixed(2)),
      qty:         s.qty,
      sendWindow:  getSendWindow(s.month),
      catalogSegment: prod.segment,
    });
  });

  return signals;
}

function getSendWindow(month) {
  if([3,4].includes(month))  return "Early March – send sandal-prep campaign";
  if([5,6,7].includes(month)) return "May–July – summer legs / cooling push";
  if([9,10].includes(month)) return "Sept–Oct – autumn wellness push";
  if([11,12,1].includes(month)) return "Nov–Jan – winter warming / gift season";
  if([2].includes(month))    return "February – end of cold season clearance";
  return "Ongoing – all-year SKU";
}

// ── Campaign Lift Measurement ────────────────────────────────
function computeLift(transactions) {
  // Treatment group (treatment=1) vs control (treatment=0)
  const groups = { treatment:{revenue:0,qty:0,orders:0}, control:{revenue:0,qty:0,orders:0} };

  transactions.forEach(t => {
    const g = t.treatment===1 ? "treatment" : "control";
    groups[g].revenue += t.revenue;
    groups[g].qty     += t.qty;
    groups[g].orders  += 1;
  });

  const tCount = transactions.filter(t=>t.treatment===1).length;
  const cCount = transactions.filter(t=>t.treatment===0).length;

  const avgRevT = groups.treatment.revenue / (tCount||1);
  const avgRevC = groups.control.revenue   / (cCount||1);
  const liftPct = parseFloat((((avgRevT-avgRevC)/avgRevC)*100).toFixed(2));

  // Per SKU lift
  const skuGroups = {};
  transactions.forEach(t=>{
    if(!skuGroups[t.sku]) skuGroups[t.sku]={T_rev:0,C_rev:0,T_n:0,C_n:0,name:t.product};
    if(t.treatment===1){ skuGroups[t.sku].T_rev+=t.revenue; skuGroups[t.sku].T_n++; }
    else               { skuGroups[t.sku].C_rev+=t.revenue; skuGroups[t.sku].C_n++; }
  });

  const skuLift = Object.entries(skuGroups).map(([sku,d])=>{
    const avgT = d.T_rev/(d.T_n||1);
    const avgC = d.C_rev/(d.C_n||1);
    const lift = d.C_n>0 ? parseFloat((((avgT-avgC)/avgC)*100).toFixed(2)) : 0;
    return { sku, name:d.name, avgRevenueT:parseFloat(avgT.toFixed(2)), avgRevenueC:parseFloat(avgC.toFixed(2)), liftPct:lift };
  }).sort((a,b)=>b.liftPct-a.liftPct);

  return { groups, tCount, cCount, avgRevT:parseFloat(avgRevT.toFixed(2)), avgRevC:parseFloat(avgRevC.toFixed(2)), liftPct, skuLift };
}

// ── Parse uploaded CSV ───────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h=>h.trim().replace(/"/g,""));
  return lines.slice(1).map(line=>{
    const vals = line.split(",").map(v=>v.trim().replace(/"/g,""));
    const obj = {};
    headers.forEach((h,i)=>obj[h]=vals[i]);
    // Coerce types
    obj.qty      = parseInt(obj.qty)||1;
    obj.price    = parseFloat(obj.price)||0;
    obj.revenue  = parseFloat(obj.revenue)||(obj.price*obj.qty);
    obj.month    = parseInt(obj.month)||(new Date(obj.date).getMonth()+1);
    obj.year     = parseInt(obj.year)||(new Date(obj.date).getFullYear());
    obj.treatment= parseInt(obj.treatment)||0;
    if(!obj.line){
      const p = PRODUCT_CATALOGUE.find(p=>p.sku===obj.sku);
      obj.line = p ? p.line : "Unknown";
    }
    if(!obj.product){
      const p = PRODUCT_CATALOGUE.find(p=>p.sku===obj.sku);
      obj.product = p ? p.name : obj.sku;
    }
    return obj;
  });
}

// ── Gemini API call ──────────────────────────────────────────
// Calls the server-side proxy — API key never touches the browser.
async function callGemini(prompt, systemContext="") {
  try {
    const res  = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        prompt,
        systemContext: systemContext || undefined,
        generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
      }),
    });
    const data = await res.json();
    if (!res.ok) return `API Error: ${data.error || res.status}`;
    return data.text || "No response.";
  } catch(e) {
    return `Network error: ${e.message}`;
  }
}

// ── Agent Chat Handler ────────────────────────────────────────
async function agentChat(userMessage, analyticsContext) {
  const systemContext = `You are a customer analytics agent for Allgäuer Latschenkiefer / Dr. Theiss Naturwaren GmbH.
You have access to the following analytics summary. Answer questions concisely and in English.
Be specific, reference actual SKU names and numbers where relevant.

=== ANALYTICS SUMMARY ===
${JSON.stringify(analyticsContext, null, 2)}

=== PRODUCT CATALOGUE ===
${JSON.stringify(PRODUCT_CATALOGUE, null, 2)}
`;
  return await callGemini(userMessage, systemContext);
}

// ── AI-generated targeting narrative ────────────────────────
async function generateTargetingNarrative(signals, rfmSummary, liftData) {
  const prompt = `Based on this customer analytics data for Allgäuer Latschenkiefer:

TOP TARGETING SIGNALS (top 10):
${JSON.stringify(signals.slice(0,10), null, 2)}

RFM SEGMENT COUNTS:
${JSON.stringify(rfmSummary, null, 2)}

CAMPAIGN LIFT SUMMARY:
${JSON.stringify({ liftPct: liftData.liftPct, tCount: liftData.tCount, cCount: liftData.cCount, avgRevT: liftData.avgRevT, avgRevC: liftData.avgRevC }, null, 2)}

Write a concise (200-word) targeting strategy recommendation. Include:
1. Top 3 segment × SKU × timing combinations to prioritise
2. Which channels to use
3. One sentence on what the lift data suggests
Use plain English, no bullet points, professional tone.`;

  return await callGemini(prompt);
}

// ── Main run function (called by UI) ─────────────────────────
async function runAnalytics(transactions) {
  const rfm      = computeRFM(transactions);
  const patterns = computePatterns(transactions);
  const signals  = computeTargetingSignals(transactions, rfm);
  const lift     = computeLift(transactions);

  // RFM segment summary
  const rfmSummary = {};
  rfm.forEach(r=>{ rfmSummary[r.segment]=(rfmSummary[r.segment]||0)+1; });

  return { rfm, patterns, signals, lift, rfmSummary, transactions };
}
