# Globus Group — Invoice Agent
Problem: 
Invoice processing automation — Globus Group (St. Wendel)
The Finance team is buried in supplier invoices and doing all sorting and data entry by hand.
An Agent which takes the invoices from an email and categorizes them to send to the
right department to make them confirm its valid.

Solution:
Multi-agent autonomous invoice processing pipeline. The Gemini API key is kept securely on the server via `.env` — it is never exposed to the browser.

## Project structure

```
Q1/
├── .env.example          ← template to copy from
├── package.json
├── server/
│   └── index.js          ← Express server + Gemini proxy endpoint
└── public/               ← static frontend served by Express
    ├── index.html
    ├── style.css
    ├── agents.js
    └── app.js
```

## Setup

**1. Install dependencies**
```bash
npm install
```

**2. Add your Gemini API key**
```bash
cp .env.example .env
```
Then open `.env` and replace `your_gemini_api_key_here` with your actual key:
```
GEMINI_API_KEY=AIzaSy...
PORT=3000
```

**3. Start the server**
```bash
npm start
```

**4. Open the app**

Go to [http://localhost:3000](http://localhost:3000)

---

## How the API key security works

| Before | After |
|--------|-------|
| Key entered by user in a browser modal | Key stored in `.env` on the server |
| Key stored in `sessionStorage` (visible in DevTools) | Key never reaches the browser |
| Frontend called Gemini API directly | Frontend calls `/api/gemini` on your server |
| Server-sent to `generativelanguage.googleapis.com` | Only the server talks to Google |

The `/api/gemini` endpoint accepts `{ prompt, imageBase64?, mimeType? }` and forwards the request to Gemini using the server-side key, returning only `{ text }` to the browser.

## Development (auto-reload)

```bash
npm run dev
```
Requires `nodemon` — install with `npm install -g nodemon` if needed.
