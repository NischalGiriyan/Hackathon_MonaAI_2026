# Batch CV & Certificate Validator — Persowerk

Problem:
CV & certificate validation (fraud detection) — Persowerk Deutschland GmbH (Saarbrücken)
Seeing a wave of AI-generated CVs and certificates and worried candidates are misrepresenting experience and skills. Wants to verify real work history and skills, and confirm certificates are valid and current. 

Solution:
Upload all CVs and all certificates at once. The AI automatically matches each certificate to the right candidate, then runs fraud analysis on each one.

---

## Setup (5 minutes)

### Step 1 — Add your Gemini API key

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and add your Gemini API key:
```
GEMINI_API_KEY=your_actual_key_here
PORT=3001
```

---

### Step 2 — Start the backend

```bash
cd backend
npm install
node server.js
```

✅ You'll see: `CV Matcher backend on http://localhost:5000`

---

### Step 3 — Start the frontend (new terminal tab)

```bash
cd frontend
npm install
npm start
```

✅ Browser opens at **http://localhost:3000**

---

## How to use

1. Drop all CV files into the **left zone** (PDF, DOCX, TXT, image)
2. Drop all certificates into the **right zone**
3. Click **Analyze**
4. The AI runs 4 stages automatically:
   - Reads every document
   - Finds candidate names and skills in each
   - Matches each certificate to the right CV (even if no name on cert)
   - Runs full fraud analysis per candidate
5. Results show sorted by risk (Critical first)
6. Filter by risk level using the tabs

---

## What's detected

- AI-generated CVs
- Fake certificates / unverifiable institutions  
- Date inconsistencies between CV and certificates
- Career progression that doesn't make sense
- Certificates that don't match the CV skills claimed
- Inflated job titles

---

## Files

```
cv-matcher/
├── backend/
│   ├── server.js       ← API + Gemini AI logic
│   └── package.json
└── frontend/
    ├── public/
    └── src/
        ├── App.js      ← Full React UI
        ├── App.css
        └── index.js
```
