# FinAnalyzer Pro 🚀

AI-powered financial document analysis platform. Multi-agent AI, real-time market data, streaming chat, price alerts — ready for demo and production deployment.

---

## What's Inside

| Layer | Tech |
|---|---|
| Backend API | FastAPI + Python 3.11 |
| AI Agents | CrewAI (Analyst · Risk · Advisor) |
| LLM | Groq — Llama 3.1 70B (free tier, ~500 tok/s) |
| Streaming chat | Server-Sent Events (SSE) via Groq |
| Market data | Yahoo Finance (free, no key needed) |
| Database | SQLite (dev) → PostgreSQL (prod) |
| Task queue | Redis + Celery |
| Frontend | Next.js 14 + Tailwind CSS |
| Deploy MVP | Railway (backend) + Vercel (frontend) |
| Deploy prod | Docker Compose / AWS ECS |

---

## Quickstart — Local (5 minutes)

### 1. Clone & set up backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Open .env and add your ANTHROPIC_API_KEY
```

### 2. Start backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Visit http://localhost:8000/docs — Swagger UI is live.

### 3. Set up frontend

```bash
cd frontend
npm install
npm run dev
```

Visit http://localhost:3000 — full dashboard is live.

> **Demo mode**: If no API key is set, the app runs in demo mode.
> Market data (Yahoo Finance) works without any API key.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
# Get a FREE Groq key at console.groq.com — no credit card needed
GROQ_API_KEY=gsk_your_key_here

# Pick your model (recommended for demo):
GROQ_MODEL=llama-3.1-70b-versatile

# SQLite — zero setup for local dev
DATABASE_URL=sqlite+aiosqlite:///./finanalyzer.db
```

### Why Groq?
| | Groq | OpenAI GPT-4o | Anthropic Claude |
|---|---|---|---|
| Speed | ~500 tok/s | ~50 tok/s | ~80 tok/s |
| Free tier | Yes, generous | No | No |
| Cost | Very low | High | High |
| Model | Llama 3.1 70B | GPT-4o | Claude 3.5 |
| Best for | Demos + production | Production | Production |

---

## Docker Compose (Full Stack)

Run everything — backend, frontend, PostgreSQL, Redis — with one command:

```bash
# Copy and fill in your API key first
cp backend/.env.example backend/.env

docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs

---

## Deploy for Demo (Free)

### Backend → Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up

# Set environment variables in Railway dashboard:
# ANTHROPIC_API_KEY, DATABASE_URL (Railway provides PostgreSQL free)
```

### Frontend → Vercel

```bash
# Install Vercel CLI
npm install -g vercel

cd frontend
vercel

# Set environment variable in Vercel dashboard:
# NEXT_PUBLIC_API_URL = https://your-app.railway.app/api/v1
```

**Total cost for demo: $0/month** (Railway free tier + Vercel free tier)

---

## API Endpoints

### Documents
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/documents/upload` | Upload PDF/CSV files |
| GET | `/api/v1/documents` | List all documents |
| DELETE | `/api/v1/documents/{id}` | Delete a document |

### Analysis
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/analyze` | Run multi-agent AI analysis |
| GET | `/api/v1/analyses` | List past analyses |

### Chat
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/chat` | Streaming AI chat (SSE) |

### Market Data
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/market/quote/{ticker}` | Live price quote |
| GET | `/api/v1/market/history/{ticker}` | Price history |
| GET | `/api/v1/market/search?q=` | Search tickers |
| GET | `/api/v1/market/news/{ticker}` | Latest news |

### Alerts
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/alerts` | Create price alert |
| GET | `/api/v1/alerts` | List active alerts |
| DELETE | `/api/v1/alerts/{id}` | Delete alert |

---

## Project Structure

```
finanalyzer/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   ├── api/
│   │   └── routes.py            # All API routes
│   ├── core/
│   │   ├── config.py            # Settings / env vars
│   │   └── database.py          # SQLAlchemy models + async DB
│   └── services/
│       ├── ai_service.py        # CrewAI multi-agent analysis
│       ├── market_service.py    # Yahoo Finance data
│       └── chat_service.py      # Streaming AI chat
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Main dashboard (all tabs)
│   │   │   └── layout.tsx
│   │   ├── lib/
│   │   │   └── api.ts           # API client
│   │   └── styles/
│   │       └── globals.css      # Dark finance theme
│   ├── package.json
│   ├── tailwind.config.js
│   ├── Dockerfile
│   └── vercel.json
├── docker-compose.yml
├── railway.toml
└── .github/
    └── workflows/
        └── deploy.yml           # GitHub Actions CI/CD
```

---

## Adding Stripe Later (Phase 2)

When you're ready to monetize after the demo:

```bash
pip install stripe
```

Add to `backend/api/routes.py`:
```python
import stripe
stripe.api_key = settings.STRIPE_SECRET_KEY

@router.post("/billing/create-checkout")
async def create_checkout(plan: str):
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        mode="subscription",
        line_items=[{"price": PRICE_IDS[plan], "quantity": 1}],
        success_url="https://yourapp.com/success",
        cancel_url="https://yourapp.com/cancel",
    )
    return {"url": session.url}
```

---

## Selling This Product

### As SaaS (recurring revenue)
- Starter: $29/month — 10 docs, basic analysis
- Pro: $99/month — unlimited docs, alerts, chat
- Enterprise: $499+/month — white-label, API access, custom agents

### As a codebase (one-time sale)
- List on **Gumroad** at $299–$999
- List on **Acquire.com** for $5k–$50k to fintech buyers
- **AppSumo** lifetime deal at $199 → 200–500 sales in launch week

### Target buyers
- Wealth management firms
- Hedge fund startups
- Fintech agencies wanting a white-label solution
- Individual investors who want their own tool

---

## Roadmap (Next Steps)

- [ ] Stripe billing integration
- [ ] User authentication (Supabase Auth / Clerk)
- [ ] Email alerts via SMTP
- [ ] Scheduled weekly PDF reports (Celery beat)
- [ ] Vector DB / pgvector for RAG document chat
- [ ] Multi-user support with isolated data
- [ ] AWS ECS deployment config
