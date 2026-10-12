# LexAgent — AI-Powered Consumer Dispute Adjudication System ⚖️

> A multi-agent adversarial debate architecture for automated legal decision support under the **Indian Consumer Protection Act, 2019**, built on closed-book FAISS Retrieval-Augmented Generation (RAG) and 2-layer statutory grounding validation.

---

## 🌟 Key Capabilities
- 🎯 **Module A — Legal Knowledge Graph & Vector Store**: 3,638 statutory section-level chunks & precedent case judgments embedded into local FAISS vector space.
- 🔐 **Module B — Auth & User Management**: Role-based access control (User vs Admin), JWT tokens, bcrypt password hashing, and user thread isolation.
- 🔬 **Module C — Semantic Grounding Validator**: Layer 1 regex audit & Layer 2 NLI semantic entailment validator (`entailed`, `contradicted`, `unsupported`).
- 📊 **Module D — Evaluation & Benchmark Harness**: 138-case gold dataset evaluation comparing Plain LLM (System A) vs LexAgent Pipeline (System B).
- 👍 **Module E — Feedback Loop**: Thumbs-up / thumbs-down rating & comment logging for continuous alignment and RLHF research.
- 📄 **Module F — Verdict Export & Citation Graph**: Formal court-order PDF generator (`pdfkit`) & interactive D3 force-directed citation co-occurrence graph.
- 🎨 **Module G — Legal Design System**: Dark/Light mode tokens (`:root` / `[data-theme="light"]`), Fraunces/Inter/IBM Plex Mono typography, and signature **Balance Bar** scale component.
- 💻 **Module H — Multi-Route Frontend**: React single-page application with 10 routes (`/courtroom`, `/new-case`, `/debate/:threadId`, `/verdict/:threadId`, `/dashboard`, `/admin`, etc.).
- 👑 **Module I — Admin Analytics Dashboard**: Real-time Recharts monitoring query volume, domain distribution, confidence trends, and blocked hallucinations.
- ⚡ **Module J — Rate Limiting & Security**: Express rate limiting protecting API key costs and server resources.
- 🌐 **Module K — Live Indian Law Search (optional)**: Searches all Indian Central/State laws live via the [Indian Kanoon API](https://api.indiankanoon.org) alongside the local CPA 2019 FAISS index. Live citations show a **● LIVE** badge with a link to the Indian Kanoon page.

---

## 🛠️ Tech Stack
| Component | Technology |
| :--- | :--- |
| **Frontend UI** | React 19, Vite, React Router v7, Tailwind CSS, Recharts, D3.js |
| **Backend API** | Node.js (ESM), Express.js 5, Server-Sent Events (SSE) |
| **LLM Engine** | Google Gemini API (`gemini-2.5-flash`), LangChain Google GenAI |
| **Vector Database** | Local Dense FAISS Store (768-dim embeddings) |
| **Database** | MongoDB (Mongoose Schema ORM) |
| **Testing** | Jest 30 (Node ESM runner) |
| **PDF Streaming** | PDFKit |

---

## 🚀 Quickstart Installation & Running

### 1. Prerequisites
- Node.js (v18.x or higher)
- MongoDB running locally (`mongodb://127.0.0.1:27017`)
- Google Gemini API Key

### 2. Backend Setup
```bash
cd backend
npm install --legacy-peer-deps
cp .env.example .env
# Edit .env and enter your GEMINI_API_KEY
```

**Optional: live Indian law search.** Add your Indian Kanoon API token to `backend/.env`:
```bash
INDIAN_KANOON_API_TOKEN=your_token_here
# Optional tuning (defaults shown)
LIVE_DOCS_PER_QUERY=2        # top docs fetched per search query
LIVE_MAX_SECTIONS=4          # max live sections merged into retrieval
LIVE_MAX_CONTENT_CHARS=2500  # plain-text length kept per live doc
```
Without the token, LexAgent works exactly as before using the local CPA 2019 index only. Each Indian Kanoon call is billed, so fetched documents are cached in memory. The live search code lives in `backend/services/indianKanoon.js` and is merged into retrieval by `backend/services/hybridRetriever.js`. `GET /api/status` reports `live_law: true|false`.

### 3. Build Vector Index & Seed Admin
```bash
npm run rebuild-data    # Builds FAISS index from normalized statutes
node scripts/seedAdmin.js # Creates default admin: admin@lexagent.dev / Admin@123456
```

### 4. Run Servers
```bash
# Terminal 1: Backend Server (Port 5000)
cd backend
npm start

# Terminal 2: Frontend Server (Port 5173)
cd frontend
npm run dev
```

---

## 🧪 Testing & Evaluation
```bash
# Run backend Jest unit & integration test suites (14 tests across 5 suites)
cd backend
npm test

# Run full evaluation benchmark pipeline (138 curated test cases)
npm run eval:full
```

---

## 📜 Research Paper Benchmark Output (`backend/eval/results/report.md`)
```
| Metric | Plain LLM Baseline (System A) | LexAgent Full Pipeline (System B) |
| :--- | :---: | :---: |
| Outcome Accuracy | 100.0% | 100.0% |
| Citation Hallucination Rate | 0.0% | 0.0% |
| Expected Calibration Error (ECE) | 0.520 | 0.520 |
| Semantic Entailment Checks | - | 54 Claims Fact-Checked |
```
