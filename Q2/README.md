# 🏥 UKS Shift Replacement Agent
### Universitätsklinikum des Saarlandes — Multi-Agent HR System

Problem:
Shift replacement agent — Universitätsklinikum des Saarlandes / UKS (Homburg)
HR needs to fill last-minute night-shift gaps when staff call in sick, often within hours. Wants an agent they can message whenever a schedule changes, which then finds available qualified staff and reaches out automatically. Time-sensitive, high-stakes use case — strong showcase for an action-taking agent.

Solution:
A multi-agent AI system that helps HR fill last-minute night-shift gaps by automatically finding qualified available staff and generating personalized outreach messages.

---

## Architecture

```
User (HR) → React UI
                ↓
          Node.js API (Express)
                ↓
          Orchestrator Agent
         /    |      |      \
   Intent  Schedule  Outreach  Response
   Parser  Analyzer  Agent    Synthesizer
   (Gemini Flash 2.5 × 4)
```

### Agents

| Agent | Role |
|-------|------|
| **Intent Parser** | Understands what HR is asking (sick call details, shift info) |
| **Schedule Analyzer** | Reads XLSX data, finds qualified + available candidates |
| **Outreach Agent** | Generates personalized German SMS/email messages |
| **Response Synthesizer** | Creates final actionable HR report |

---

## Prerequisites

- Node.js 18+
- Gemini API key ([get one free](https://aistudio.google.com/apikey))

---

## Setup & Run

### 1. Clone / extract the project

```bash
cd Q2
```

### 2. Install all dependencies

```bash
# Install root, server, and client deps
npm run install-all
```

Or manually:
```bash
npm install
cd server && npm install
cd ../client && npm install
```

### 3. Start the application

```bash
npm start
```

This starts:
- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:3000

### 4. Use the app

1. Open http://localhost:3000
2. Click **"Use Demo Schedule (UKS)"** to load the provided XLSX, or upload your own
3. Start chatting! Example: *"Felix Haddad just called in sick for the ICU night shift tonight. Find a replacement."*

---

## Using Your Own XLSX

The system dynamically reads any XLSX with these sheets:
- **Roster** — Staff info: Employee ID, Name, Role, Department, Certifications, Status, Phone, Max Hrs/Week, etc.
- **Weekly_Schedule** — Staff × dates grid with shift codes (D=Day, N=Night, O=Off)
- **Shift_Reference** — Shift code definitions
- **Scenario** (optional) — Pre-defined scenario context

---

## Example Queries

- `"Felix Haddad called in sick for the ICU night shift on Sat 06/20"`
- `"Who can cover a Registered Nurse night shift in ICU tonight? Need BLS and ACLS."`
- `"List all staff off tonight with ACLS certification"`
- `"Show me available nurses for the night shift this weekend"`

---

## Project Structure

```
Q2/
├── package.json              # Root - run both services
├── server/
│   ├── index.js              # Express API
│   ├── hospital_schedule_part_2.xlsx  # Demo schedule
│   ├── agents/
│   │   ├── orchestrator.js   # Coordinates all agents
│   │   ├── intentParser.js   # Parses HR messages
│   │   ├── scheduleAnalyzer.js  # Finds candidates
│   │   ├── outreachAgent.js  # Generates messages
│   │   ├── responseSynthesizer.js  # Final report
│   │   └── geminiClient.js   # Gemini API wrapper
│   └── package.json
│   └── .env.example
└── client/
    ├── src/
    │   ├── App.js            # Main React app
    │   └── App.css           # Styles
    └── package.json
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/load-default` | Load bundled demo XLSX |
| POST | `/api/upload` | Upload custom XLSX |
| POST | `/api/chat` | Send message (SSE stream) |
| GET | `/api/session/:id` | Get session info |

---

## Real-Time Agent Events (SSE)

The `/api/chat` endpoint streams Server-Sent Events:

```json
{ "type": "agent_start", "agentName": "Schedule Analyzer", "data": { "message": "Scanning roster..." } }
{ "type": "agent_complete", "agentName": "Schedule Analyzer", "data": { "candidatesFound": 4 } }
{ "type": "done", "result": { "summary": "...", "candidates": [...], "outreach": [...] } }
```

---

## Notes

- The API key is never stored — it's sent per-request and held in React state only
- Session data is in-memory (resets on server restart)
- All XLSX parsing is dynamic — nothing is hardcoded from the spreadsheet
