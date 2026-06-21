# Dr. Theiss — Customer Analytics Agent

Problem:
Target-group & customer analytics agent — Dr. Theiss Naturwaren GmbH (Homburg)
Wants to ingest customer data, detect behavioral patterns, and generate targeting signals to deliver advertising at the optimal date and time — then measure afterwards whether it lifted sales for the marketed product.

Solution:
An AI-powered customer analytics dashboard for **Dr. Theiss / Allgäuer Latschenkiefer** product lines. It generates synthetic transaction data, performs RFM segmentation, detects behavioral patterns, and lets you query insights through a Gemini-powered chat interface.

---

## Features

- **RFM Analysis** — Scores customers on Recency, Frequency, and Monetary value, then segments them into Champions, Loyal Customers, At Risk, and more
- **Behavioral Patterns** — Detects seasonal trends, regional preferences, channel distribution, and weather-based purchase correlations
- **Customer Targeting** — Identifies high-value segments and generates targeting recommendations per product line
- **Lift Simulation** — Simulates A/B treatment groups to measure campaign lift
- **AI Chat Interface** — Ask natural language questions about your data, powered by Google Gemini (gemini-2.5-flash)
- **Interactive Charts** — Visualizes KPIs, segment breakdowns, and trends using Chart.js
- **15 SKU Product Catalogue** — Covers Feet, Legs, Muscles/Joints, and Cough Drops product lines

---

## Project Structure

```
Q7/
├── server/
│   └── index.js          # Express server + Gemini API proxy
├── public/
│   ├── index.html        # Frontend dashboard UI
│   └── agent.js          # Data engine (RFM, patterns, targeting, lift)
├── package.json
├── package-lock.json
└── .env.example          # API key config sample
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v16 or higher
- A **Google Gemini API key** — get one at [aistudio.google.com](https://aistudio.google.com)

---

## Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure your API key

Create a `.env` file in the root of the project:

```bash
touch .env
```

Add your Gemini API key inside it:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

> ⚠️ Never commit your `.env` file to GitHub. Make sure `.env` is in your `.gitignore`.

### 4. Start the server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

### 5. Open the app

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## Usage

1. **Load Data** — The app auto-generates 800 synthetic transactions across 150 customers on startup
2. **View KPIs** — See total revenue, customer count, average order value, and top product at a glance
3. **Explore RFM Segments** — Browse customer segments with scores and behavioral labels
4. **Analyze Patterns** — View seasonal, regional, channel, and weather-based purchase breakdowns
5. **Chat with AI** — Ask questions like:
   - *"Which customer segment has the highest churn risk?"*
   - *"What products peak in summer?"*
   - *"Show me targeting recommendations for Loyal Customers"*

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS + Chart.js |
| Backend | Node.js + Express |
| AI Model | Google Gemini (gemini-2.5-flash) |
| Environment | dotenv |
| HTTP (server) | node-fetch |

---

## Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Your Google Gemini API key (required) |
| `PORT` | Server port (optional, defaults to `3000`) |

