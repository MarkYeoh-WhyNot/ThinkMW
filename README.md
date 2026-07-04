# ThinkMW

GraphRAG-powered knowledge assessment platform for secondary school students.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React Flow, TailwindCSS, Zustand |
| Backend API | FastAPI, Celery |
| Graph DB | Neo4j Aura |
| Relational DB | Supabase (Postgres) |
| Cache / Queue | Redis (Upstash) |
| LLM | Claude Sonnet 4.6 (extraction + judge) |
| Embeddings | OpenAI text-embedding-3-small |
| Graph algorithms | NetworkX |
| File storage | AWS S3 |
| PDF parsing | PyMuPDF |

## Project Structure

```
thinkmw/
├── frontend/                  # Next.js 14 app
│   ├── app/
│   │   ├── auth/              # Login / register
│   │   ├── student/           # Student dashboard + canvas
│   │   └── teacher/           # Teacher dashboard + topic management
│   ├── components/
│   │   ├── canvas/            # GraphCanvas, ConceptNode, NodeTray, EdgeLabelModal
│   │   ├── teacher/           # Upload form, class heatmap, alias builder
│   │   └── ui/                # Shared UI primitives
│   └── lib/
│       ├── stores/            # Zustand canvas store
│       ├── api/               # Axios client
│       └── hooks/             # Custom React hooks
│
├── backend/                   # FastAPI app
│   └── app/
│       ├── api/routes/        # topics, sessions, graphs, classes, users
│       ├── core/              # Config, settings
│       ├── db/                # Neo4j + Supabase clients
│       ├── models/            # Pydantic schemas
│       ├── services/
│       │   ├── ai/            # extractor.py (Claude), semantic.py (embeddings)
│       │   ├── graph/         # neo4j_ops.py
│       │   └── scoring/       # scorer.py (NetworkX)
│       └── workers/           # Celery tasks (async graph generation)
│
├── docs/
│   └── supabase_schema.sql    # Run this first in Supabase SQL editor
│
└── docker-compose.yml         # Neo4j + Redis + backend + worker
```

## Quick Start

### 1. Clone and set up environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
# Fill in your API keys in both files
```

### 2. Run Supabase schema

Open your Supabase project → SQL Editor → paste and run `docs/supabase_schema.sql`

### 3. Start backend services

```bash
docker compose up
```

This starts Neo4j, Redis, the FastAPI server, and the Celery worker.

### 4. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:3000
API runs at http://localhost:8000
Neo4j browser at http://localhost:7474

## Key Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API — graph extraction + LLM judge |
| `OPENAI_API_KEY` | Embeddings only (text-embedding-3-small) |
| `NEO4J_URI` | Neo4j connection string |
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | Supabase project |
| `AWS_S3_BUCKET` | PDF upload storage |

## Core Flow

1. Teacher uploads PDF → S3 → Celery job queued
2. Celery: PyMuPDF extracts text → Claude extracts graph → written to Neo4j
3. Student opens topic → fetches concept nodes → builds graph on canvas
4. Student submits → edges processed through semantic layer → scored vs standard
5. Gap report returned → teacher dashboard updated
