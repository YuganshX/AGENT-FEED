# AGENT-FEED

### An Autonomous Editorial Persona That Discovers, Decides, Remembers, and Publishes

**AGENT-FEED** is an autonomous editorial agent built to operate continuously without requiring a human prompt for every piece of content.

Instead of simply generating posts on demand, the agent periodically discovers current information, evaluates whether a topic is worth publishing, checks its previous editorial memory, generates content in a defined persona and voice, and stores the resulting publication history.

The system is designed around a **single autonomous editorial agent** rather than a multi-agent architecture.

---

## ✨ What It Does

AGENT-FEED follows an autonomous editorial loop:

```text
Discover
   ↓
Retrieve Memory
   ↓
Evaluate Candidates
   ↓
Decide: Publish / Skip
   ↓
Generate Post
   ↓
Store Publication
   ↓
Remember Decision & Content
   ↓
Repeat Automatically
```

The agent can therefore develop continuity over time instead of treating every execution as an isolated request.

### Core capabilities

* 🔎 **Live topic discovery** using Tavily
* 🧠 **Long-term semantic memory** using Breith
* ✍️ **Persona-driven editorial generation** using Gemini
* 🎯 **Autonomous publish/skip decisions**
* 📚 **Previous-coverage retrieval** to reduce repetitive content
* 🗃️ **Persistent execution and publication history** using Cloudflare D1
* ⏰ **Scheduled autonomous execution** using Cloudflare Cron Triggers
* 🌐 **HTTP API** for initialization and feed retrieval
* 🧩 **Configurable persona, domain, voice, principles, and publishing threshold**

---

## 🧠 How the Agent Works

When an agent is initialized, it receives a persona name and editorial domain.

For example:

```json
{
  "persona": {
    "name": "Tech Observer",
    "domain": "Artificial Intelligence"
  }
}
```

The system creates an editorial configuration containing:

* Mission
* Voice
* Editorial principles
* Discovery queries
* Publishing threshold

The agent then performs its first autonomous run.

### 1. Discover

The discovery layer searches for relevant current information and produces a set of candidate topics.

```text
Web / Primary Sources
        ↓
      Tavily
        ↓
Candidate Topics
```

### 2. Recall

Before making an editorial decision, the agent retrieves semantically related memories from previous runs.

This allows it to consider:

* Previous coverage
* Previous editorial decisions
* Previously published topics
* Existing context around a subject

### 3. Decide

The editorial layer evaluates the candidate set and determines:

```text
Should I publish?
Which candidate?
What score does it receive?
Why is it worth publishing?
What angle should I take?
```

A candidate is only published when the decision satisfies the configured publishing threshold.

### 4. Generate

Once a topic is selected, Gemini generates the actual editorial post according to the persona's:

* Voice
* Mission
* Editorial principles
* Selected topic
* Editorial angle
* Previous relevant memory

### 5. Persist

The generated post and execution metadata are stored in Cloudflare D1.

The system records information such as:

* Post ID
* Creation time
* Generated text
* Rationale
* Topic
* Publishing score
* Source URLs
* Agent run status

### 6. Remember

The agent sends relevant information back to Breith so future runs can retrieve previous editorial context.

This creates a feedback loop:

```text
Past Decisions
      ↓
Semantic Memory
      ↓
Future Editorial Decisions
      ↓
New Content
      ↓
New Memories
      ↺
```

---

## 🏗️ Architecture

```text
                         ┌─────────────────────┐
                         │   Cloudflare Cron   │
                         │    Every 2 Hours    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   AGENT-FEED        │
                         │ Cloudflare Worker   │
                         └──────────┬──────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
                 ▼                  ▼                  ▼
          ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
          │   Tavily    │    │   Breith    │    │   Gemini    │
          │  Discovery  │    │   Memory    │    │  Editorial  │
          └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
                 │                  │                  │
                 └──────────────────┼──────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    Cloudflare D1    │
                         │ Persistent State &  │
                         │ Publication History │
                         └─────────────────────┘
```

---

## 🛠️ Tech Stack

| Technology                   | Purpose                            |
| ---------------------------- | ---------------------------------- |
| **TypeScript**               | Application development            |
| **Cloudflare Workers**       | Autonomous agent runtime           |
| **Cloudflare D1**            | Persistent relational storage      |
| **Cloudflare Cron Triggers** | Scheduled execution                |
| **Google Gemini**            | Editorial reasoning and generation |
| **Tavily**                   | Current information discovery      |
| **Breith**                   | Semantic long-term memory          |
| **Wrangler**                 | Local development and deployment   |

The project is configured as a Cloudflare Worker with `src/index.ts` as its entry point and a Cron Trigger scheduled every two hours.

---

## 📁 Project Structure

```text
AGENT-FEED/
│
├── migrations/
│   └── ...
│
├── src/
│   ├── services/
│   │   ├── breeth.ts
│   │   ├── discovery.ts
│   │   └── editorial.ts
│   │
│   ├── agent.ts
│   ├── db.ts
│   ├── index.ts
│   └── types.ts
│
├── .gitignore
├── PROMPTS.md
├── package.json
├── package-lock.json
├── tsconfig.json
└── wrangler.jsonc
```

The main agent orchestration lives in `src/agent.ts`, while the Worker HTTP and scheduled-entry logic is handled by `src/index.ts`.

---

## 🚀 Getting Started

### Prerequisites

You will need:

* Node.js
* npm
* A Cloudflare account
* Wrangler
* Gemini API access
* Tavily API access
* Breith API access

### Install dependencies

```bash
npm install
```

### Authenticate Wrangler

```bash
npx wrangler login
```

---

## 🗄️ Database Setup

AGENT-FEED uses Cloudflare D1 as its persistent database.

Apply migrations locally:

```bash
npm run db:local
```

Apply migrations to the remote D1 database:

```bash
npm run db:remote
```

The available database scripts are defined in `package.json`.

---

## 🔐 Environment Variables

The Worker expects the following secrets:

```text
BREETH_API_KEY
GEMINI_API_KEY
TAVILY_API_KEY
```

Optional configuration variables include:

```text
GEMINI_MODEL
BREETH_BASE_URL
TAVILY_BASE_URL
```

These values are defined through the Worker environment rather than hard-coded API credentials.

### Set secrets with Wrangler

```bash
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put TAVILY_API_KEY
npx wrangler secret put BREETH_API_KEY
```

Do **not** commit API keys to the repository.

---

## 💻 Local Development

Start the Cloudflare Worker locally:

```bash
npm run dev
```

Run TypeScript validation:

```bash
npm run typecheck
```

The project uses Wrangler for local Worker development and deployment.

---

## 🌐 API

### Initialize an Agent

```http
POST /api/agent/init
```

Request:

```json
{
  "persona": {
    "name": "Tech Observer",
    "domain": "Artificial Intelligence"
  }
}
```

Successful response:

```json
{
  "agentId": "..."
}
```

The initialization endpoint creates the agent configuration, stores the agent, initializes its identity in memory, and triggers an initial autonomous run.

---

### Retrieve the Feed

```http
GET /api/agent/feed?agentId=<AGENT_ID>
```

Response:

```json
{
  "posts": [
    {
      "id": "...",
      "createdAt": "...",
      "text": "...",
      "rationale": "...",
      "sources": [
        "https://example.com/article"
      ]
    }
  ]
}
```

If the requested agent does not exist, the API returns an empty feed.

---

## ⏰ Autonomous Execution

The Worker is configured with a Cron Trigger:

```text
0 */2 * * *
```

This causes the agent system to execute every two hours.

During a scheduled run, all configured agents are processed automatically.

No human prompt is required after initialization.

---

## 🎭 Persona Model

Each agent has a structured editorial configuration:

```text
Persona
├── Name
├── Domain
├── Mission
├── Voice
├── Editorial Principles
├── Discovery Queries
└── Publish Threshold
```

This allows the same underlying agent architecture to operate with different editorial identities.

The persona determines **how the agent interprets information**, not merely how the final text is phrased.

---

## 🧠 Memory-Driven Editorial Behavior

A major design goal of AGENT-FEED is to avoid treating every execution as a blank slate.

Before making a publishing decision, the agent retrieves related previous coverage and editorial decisions.

After a decision:

* Skipped topics can be remembered.
* Published content can be remembered.
* Editorial rationale can be remembered.
* Future runs can use this context.

This enables increasingly contextual editorial behavior over time.

---

## 🔄 End-to-End Flow

```text
                    ┌───────────────┐
                    │ Cron Trigger  │
                    └───────┬───────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │ Discover Topics │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │ Recall Memory   │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │ Editorial Judge │
                   └────────┬────────┘
                            │
                 ┌──────────┴──────────┐
                 │                     │
              SKIP                   PUBLISH
                 │                     │
                 ▼                     ▼
          Remember Decision     Generate Post
                                       │
                                       ▼
                                Store in D1
                                       │
                                       ▼
                                Remember Post
                                       │
                                       ▼
                                   Next Run
```

---

## 🧪 Validation

Run the TypeScript checker:

```bash
npm run typecheck
```

Run the local development server:

```bash
npm run dev
```

Before deployment, verify:

* D1 migrations are applied
* API secrets are configured
* Worker bindings are correct
* Agent initialization succeeds
* A feed can be retrieved
* Scheduled execution is enabled
* Memory operations do not expose credentials

---

## 🚀 Deployment

Deploy the Worker using Wrangler:

```bash
npm run deploy
```

The project is already configured for Cloudflare Workers deployment through `wrangler.jsonc`.

After deployment, the Worker exposes the same API endpoints:

```text
POST /api/agent/init
GET  /api/agent/feed?agentId=<AGENT_ID>
```

---

## 🔒 Security

API credentials should always be stored as Cloudflare Worker secrets.

Never commit:

```text
GEMINI_API_KEY
TAVILY_API_KEY
BREETH_API_KEY
```

to GitHub.

The repository should contain configuration and code, not production credentials.

---

## 📌 Current Scope

AGENT-FEED currently focuses on the autonomous editorial backend.

The core system provides:

* Agent initialization
* Editorial configuration
* Topic discovery
* Semantic memory retrieval
* Autonomous publish/skip decisions
* AI-generated posts
* Persistent feed storage
* Scheduled execution
* Memory updates

The architecture is intentionally lightweight and serverless, using Cloudflare Workers and D1 rather than requiring a continuously running application server.

---

## 🛣️ Future Improvements

Potential extensions include:

* [ ] Web dashboard for monitoring agent runs
* [ ] Multiple persona profiles
* [ ] More discovery sources and RSS feeds
* [ ] Editorial analytics
* [ ] Topic deduplication improvements
* [ ] Human approval mode
* [ ] Social-platform publishing integrations
* [ ] Run history and observability dashboard
* [ ] More granular memory retrieval
* [ ] Automated evaluation of editorial quality

---

## 📄 License

Add your preferred license here.

---

## 👤 Author

**YuganshX**

GitHub:
https://github.com/YuganshX

Project:
https://github.com/YuganshX/AGENT-FEED
