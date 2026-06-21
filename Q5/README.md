# Interview Copilot — Kohlpharma GmbH

Problem:
Interview support for non-technical hirer — Kohlpharma GmbH (Merzig)
A non-technical hiring manager posted a technical role on Indeed and doesn't know what to ask candidates. Wants help generating relevant interview questions and spotting red flags. (Jobs&joy transparency use case enterprise)

Solution:
AI-powered interview assistant for non-technical hiring managers.

---

## What this does
1. **Generate Interview Guide** — Paste a job title + description, get a full interview kit with questions, what to listen for, and red flags.
2. **Analyze Candidate Answers** — Paste what a candidate said, get a green/yellow/red rating and a follow-up question to dig deeper.

---

## Setup (one time)

### 1. Add your Gemini API key

```bash
cd server
cp .env.example .env
```

Open `server/.env` and add your Gemini API key:
```
GEMINI_API_KEY=your_actual_key_here
PORT=3001
```

### 2. Install and start the backend
```bash
cd server
npm install
node index.js
```
You should see: `Server running on http://localhost:3001`

### 3. Install and start the frontend (new terminal)
```bash
cd client
npm install
npm start
```
Browser opens automatically at `http://localhost:3000`

---

## Project structure
```
Q5/
├── server/
│   ├── index.js        ← Express backend + Gemini API calls
│   └── package.json
└── client/
    ├── src/
│   │   ├── App.js      ← React UI
│   │   ├── App.css     ← Styles
│   │   └── index.js    ← Entry point
    └── public/
        └── index.html
```

---

## Notes
- Both terminals must be running at the same time.
- The `proxy` in `client/package.json` routes `/api/*` calls to the backend automatically.
- To print or save the interview guide as PDF: use the "Print / Save as PDF" button.
