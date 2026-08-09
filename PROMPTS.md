# AGENT-FEED — Vibe Coding / Build Prompt History

> This document captures the way the project was built: iteratively, experimentally, and by debugging real failures instead of pretending the first implementation was perfect.
>
> The goal is to make the project reproducible and to preserve the architectural reasoning behind the implementation.

---

# 1. Project Goal

Build an autonomous AI agent that can:

1. Store agent configuration in Cloudflare D1.
2. Run an agent workflow manually and through scheduled execution.
3. Discover relevant information from external sources.
4. Use an LLM to reason over candidate content.
5. Decide whether something is worth publishing.
6. Publish the selected result through the Breeth API.
7. Store execution history and failures.
8. Expose an API endpoint for the agent's feed.
9. Run locally with Cloudflare Wrangler before deploying.

The project should feel like an actual autonomous content/feed agent rather than a simple CRUD API.

---

# 2. Core Stack

Use:

- Cloudflare Workers
- Wrangler
- Cloudflare D1
- TypeScript
- Gemini API
- Tavily API
- Breeth API
- Local `.dev.vars` secrets
- Cloudflare scheduled events
- REST endpoints for manual testing

Initial development was designed around an OpenAI-compatible LLM flow, but the implementation was later moved to Gemini Flash.

---

# 3. High-Level Architecture

```text
                         ┌──────────────────────┐
                         │      Scheduler       │
                         │ /cdn-cgi/local/...   │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    Agent Runner      │
                         │    handleInit()      │
                         └──────────┬───────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
                ▼                   ▼                   ▼
        ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
        │   Cloudflare │    │    Tavily    │    │    Gemini    │
        │      D1      │    │    Search    │    │    Reasoning │
        └──────────────┘    └──────────────┘    └──────────────┘
                │                   │                   │
                │                   └─────────┬─────────┘
                │                             ▼
                │                    Candidate selection
                │                             │
                ▼                             ▼
        ┌──────────────┐              ┌──────────────┐
        │  agent_runs  │              │    Breeth    │
        │   history    │              │ Publish API  │
        └──────────────┘              └──────────────┘
                                             │
                                             ▼
                                      Published post
                                             │
                                             ▼
                                      Agent feed API
```

The important architectural decision is to keep the Worker as the orchestration layer.

The Worker should not become a giant database wrapper or an LLM-only application. It coordinates:

```text
Trigger → DB → Search → LLM → Decision → Publish → DB → Feed
```

---

# 4. Vibe-Coding Approach

The project was intentionally built incrementally.

Do not try to generate the entire application in one huge step.

The development loop should be:

```text
Build a small piece
      ↓
Run it
      ↓
Read the actual error
      ↓
Inspect the database / API response
      ↓
Fix the smallest broken layer
      ↓
Run again
      ↓
Only then continue
```

This is important because Cloudflare Workers + D1 + external APIs have different failure surfaces.

For example:

- Worker can start while D1 schema is missing.
- D1 can contain the agent while Gemini can still fail.
- Gemini can work while Breeth authentication fails.
- The feed endpoint can work while the agent run itself is failing.
- A scheduled trigger can fire successfully while the actual agent workflow fails internally.

Treat each layer independently.

---

# 5. Database-First Architecture

The D1 database stores persistent state.

At minimum, maintain tables for:

- `agents`
- `agent_runs`
- posts / published content as required by the implementation

The `agents` table represents the configuration and identity of an autonomous agent.

Example agent:

```text
id:
14e12be9-f60c-458e-b8f8-1fcb551b77d0

name:
AI Technology Analyst

domain:
artificial intelligence and technology
```

The `agent_runs` table is especially important because autonomous systems need observability.

A run should capture things such as:

```text
id
agent_id
started_at
completed_at
status
candidates_found
published_post_id
decision_reason
error
```

This makes failures inspectable without relying only on Worker logs.

---

# 6. Important D1 Debugging Scenario

One of the first real problems encountered during local development was:

```text
D1_ERROR: no such table: agents
```

The Worker was starting correctly, but the local D1 database did not yet contain the expected schema.

The stack trace pointed into:

```text
src/index.ts
handleInit()
```

The important realization:

> Worker startup success does not mean database initialization success.

The fix was to run the D1 migration against the local database.

After migration, verify the actual database instead of assuming it worked.

Example:

```powershell
npx wrangler d1 execute AGENT_DB --local --command "SELECT id, name, domain, created_at FROM agents;"
```

Expected verification:

```text
AI Technology Analyst
artificial intelligence and technology
```

This debugging step should remain documented because it demonstrates the difference between:

```text
Worker is running
```

and:

```text
Application state is initialized
```

---

# 7. Local Wrangler Environment

Local development uses Wrangler:

```powershell
npx wrangler dev
```

Secrets are loaded from:

```text
.dev.vars
```

The Worker exposes bindings similar to:

```text
env.AGENT_DB
env.GEMINI_MODEL
env.BREETH_BASE_URL
env.TAVILY_BASE_URL
env.GEMINI_API_KEY
env.BREETH_API_KEY
```

Keep secrets out of source code.

Do not hardcode:

```text
GEMINI_API_KEY
BREETH_API_KEY
TAVILY_API_KEY
```

inside TypeScript.

---

# 8. Local vs Remote D1

During debugging, explicitly distinguish:

```text
--local
```

from:

```text
--remote
```

For local development:

```powershell
npx wrangler d1 execute AGENT_DB --local --command "..."
```

This queries the local D1 database used by Wrangler.

For production/remote state, use:

```powershell
npx wrangler d1 execute AGENT_DB --remote --command "..."
```

Never assume that because an agent exists locally, it also exists remotely.

---

# 9. Agent Creation

The application successfully created an agent and returned:

```text
14e12be9-f60c-458e-b8f8-1fcb551b77d0
```

This UUID became the test agent ID.

The agent configuration was:

```text
Name:
AI Technology Analyst

Domain:
artificial intelligence and technology
```

Use this ID when manually triggering/testing the agent.

---

# 10. Feed Endpoint

The feed can be queried locally:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/agent/feed?agentId=14e12be9-f60c-458e-b8f8-1fcb551b77d0" -Method GET
```

At one point the endpoint returned:

```text
posts
{}
```

This initially looked like a feed problem.

But database inspection showed the real issue was upstream:

```text
agent_runs
status = failed
```

Therefore:

> An empty feed is not necessarily a feed API bug.

It can simply mean that the autonomous pipeline never successfully published a post.

This is a useful debugging principle:

```text
Empty output
    ↓
Check database state
    ↓
Check agent_runs
    ↓
Check external APIs
    ↓
Only then debug the feed endpoint
```

---

# 11. Scheduled Trigger Testing

Cloudflare's local scheduled trigger can be tested with:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8787/cdn-cgi/local/scheduled" -Method GET
```

A successful response:

```text
ok
```

means the scheduled route was triggered.

It does NOT necessarily mean the complete agent run succeeded.

The correct verification is:

```powershell
npx wrangler d1 execute AGENT_DB --local --command "SELECT * FROM agent_runs ORDER BY id DESC LIMIT 5;"
```

This gives actual workflow status.

---

# 12. Agent Run Observability

Example run history showed:

```text
id = 2
status = failed
candidates_found = 0
published_post_id = null
```

with an error originating from Gemini.

This is exactly why `agent_runs` exists.

Instead of asking:

> "Did the cron job work?"

ask:

```text
Did the trigger fire?
Did the run start?
Did search return candidates?
Did Gemini respond?
Did the decision succeed?
Did Breeth publish?
Was the post ID stored?
```

Each layer should be observable.

---

# 13. Switching From OpenAI to Gemini Flash

The LLM layer was initially planned around OpenAI.

During implementation, the architecture was deliberately changed to Gemini Flash.

The important design decision was:

> Do not couple the whole application to the LLM provider.

Keep LLM responsibilities behind a small abstraction.

Conceptually:

```ts
interface LLMProvider {
  generate(prompt: string): Promise<string>;
}
```

Then the application workflow does not care whether the provider is:

```text
OpenAI
Gemini
another model later
```

The workflow only expects:

```text
prompt → generated response
```

This made the OpenAI → Gemini migration much easier.

---

# 14. Why Gemini Flash

Gemini Flash was selected because the agent needs frequent lightweight reasoning rather than huge long-form generation.

Typical workload:

```text
Search results
     ↓
Summarize / analyze
     ↓
Rank candidates
     ↓
Decide publish / skip
     ↓
Generate post
```

This is a good fit for a fast model.

The configuration was moved to:

```text
GEMINI_MODEL=gemini-3.6-flash
```

and the API key was injected through:

```text
GEMINI_API_KEY
```

Do not put the key directly into source code.

---

# 15. Gemini 429 Quota Debugging

A real failure occurred after the agent was triggered.

The `agent_runs` table showed:

```text
status:
failed
```

and:

```text
candidates_found:
0
```

The error was:

```text
Gemini failed (429)
```

with:

```text
RESOURCE_EXHAUSTED
```

and:

```text
Quota exceeded
```

The relevant quota reported by the API was:

```text
generate_content_free_tier_requests
```

with a limit of:

```text
20
```

for:

```text
gemini-3.6-flash
```

The response also included a retry delay.

This is not a D1 problem.

It is not a Wrangler problem.

It is not a Breeth problem.

It is an external LLM quota problem.

The correct debugging conclusion is:

```text
Worker
  ↓
Agent runner
  ↓
Gemini request
  ↓
429 RESOURCE_EXHAUSTED
  ↓
agent_runs.status = failed
  ↓
no post
  ↓
feed remains empty
```

---

# 16. Do Not Hide LLM Errors

The Worker should record meaningful external API failures.

Bad approach:

```text
catch error
return empty result
```

This makes debugging almost impossible.

Better:

```text
catch error
store error in agent_runs
mark status = failed
surface useful error information
```

The run history should answer:

```text
What failed?
At which stage?
For which agent?
When?
Why?
```

---

# 17. Search Layer

Tavily is used as the search/discovery layer.

Configuration:

```text
TAVILY_BASE_URL
TAVILY_API_KEY
```

The conceptual pipeline is:

```text
agent.domain
      ↓
search query
      ↓
Tavily
      ↓
candidate URLs/content
      ↓
normalize candidates
      ↓
Gemini evaluation
```

Search and reasoning should remain separate.

Tavily finds information.

Gemini decides what the information means.

---

# 18. LLM Should Not Be the Search Engine

Do not ask Gemini to independently invent current news.

Instead:

```text
Tavily
    ↓
fresh candidates
    ↓
Gemini
    ↓
analysis / ranking / generation
```

This reduces hallucination risk and makes the source pipeline inspectable.

---

# 19. Breeth Publishing Layer

Breeth is treated as the publishing destination.

Configuration:

```text
BREETH_BASE_URL
BREETH_API_KEY
```

Publishing should happen only after the agent has made a decision.

Conceptually:

```text
candidate
   ↓
Gemini
   ↓
publish?
   ├── NO → finish run
   │
   └── YES
         ↓
       Breeth
         ↓
      post ID
         ↓
   store in agent_runs
```

Do not mark the run as successfully published before Breeth confirms the post.

---

# 20. Breeth API Debugging

When testing Breeth manually, use PowerShell in the form:

```powershell
Invoke-RestMethod `
  -Uri "https://api.thebreeth.com/v1/episodes" `
  -Method POST `
  -Headers @{
      Authorization = "Bearer YOUR_API_KEY"
      "Content-Type" = "application/json"
  } `
  -Body '{"content":"This is a test episode from PowerShell.","group_id":"default"}'
```

The important lesson from API debugging was:

> A command that works manually proves the endpoint and credentials can work, but does not automatically prove the Worker implementation is constructing the same request.

When an API works manually but fails from code, compare:

```text
URL
HTTP method
Authorization header
Content-Type
JSON body
field names
base URL
environment variables
```

one by one.

---

# 21. URL Debugging

PowerShell commands should use actual URLs.

Correct:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/agent/feed?agentId=14e12be9-f60c-458e-b8f8-1fcb551b77d0" -Method GET
```

Do not copy Markdown hyperlink syntax into a command:

```text
[http://example.com](http://example.com)
```

That is documentation formatting, not a URL.

When debugging command-line requests, always verify the literal value passed to `-Uri`.

---

# 22. Architecture Decision: Keep External APIs Isolated

Use separate functions/modules for:

```text
D1 access
Search
LLM
Publishing
Agent orchestration
HTTP routes
scheduled trigger
```

Avoid putting everything inside:

```text
src/index.ts
```

The Worker entry point should mostly route requests/events into application logic.

This keeps the system maintainable when adding:

- another LLM
- another publisher
- another search provider
- more agent types
- retries
- analytics

---

# 23. Architecture Decision: D1 for Durable State

Use D1 for:

```text
agents
agent_runs
published posts / metadata
```

Do not depend on in-memory Worker variables for persistent state.

Workers can restart.

Scheduled invocations are independent.

The database is the source of truth.

---

# 24. Architecture Decision: Run History

Every agent execution should produce a record.

A run lifecycle is approximately:

```text
STARTED
   ↓
SEARCHING
   ↓
CANDIDATES FOUND
   ↓
ANALYZING
   ↓
DECISION
   ↓
PUBLISHING
   ↓
COMPLETED
```

or:

```text
STARTED
   ↓
FAILED
```

The exact implementation can use the project's existing status model.

The key idea is observability.

---

# 25. Architecture Decision: Graceful Failure

External services are unreliable.

Possible failures:

```text
Tavily 429
Tavily 5xx
Gemini 429
Gemini timeout
Breeth 401
Breeth 403
Breeth 5xx
invalid JSON
D1 query failure
missing environment variable
```

The system should fail in a way that tells us where the failure happened.

Do not turn every error into:

```text
Internal Server Error
```

without recording the underlying reason.

---

# 26. Debugging Checklist

When:

```text
feed returns {}
```

check:

### Step 1 — Is Worker running?

```powershell
npx wrangler dev
```

### Step 2 — Does the agent exist?

```powershell
npx wrangler d1 execute AGENT_DB --local --command "SELECT id, name, domain, created_at FROM agents;"
```

### Step 3 — Does the scheduled trigger fire?

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8787/cdn-cgi/local/scheduled" -Method GET
```

### Step 4 — Was an agent run created?

```powershell
npx wrangler d1 execute AGENT_DB --local --command "SELECT * FROM agent_runs ORDER BY id DESC LIMIT 5;"
```

### Step 5 — Check status/error

```powershell
npx wrangler d1 execute AGENT_DB --local --command "SELECT id, status, candidates_found, decision_reason, error FROM agent_runs ORDER BY id DESC LIMIT 5;"
```

### Step 6 — Identify which external service failed

Look for:

```text
Gemini
Tavily
Breeth
```

### Step 7 — Only then inspect feed logic.

---

# 27. Current Known Debug State

At the latest debugging point, the local D1 database was healthy.

The agent existed:

```text
14e12be9-f60c-458e-b8f8-1fcb551b77d0
```

The scheduled endpoint returned:

```text
ok
```

The agent run was created.

However, the run failed during Gemini generation:

```text
Gemini failed (429)
RESOURCE_EXHAUSTED
```

Therefore:

```text
D1 = working
Agent creation = working
Scheduler trigger = working
Agent run creation = working
Gemini = quota exhausted
Publishing = not reached
Feed = empty because nothing was published
```

This distinction is critical.

Do not waste time debugging the feed endpoint until the run can complete successfully.

---

# 28. Next Debugging Priority

The next goal is NOT:

```text
"Fix feed"
```

The next goal is:

```text
"Get one complete successful agent run."
```

Target:

```text
scheduled/manual trigger
       ↓
agent_runs row created
       ↓
Tavily candidates found
       ↓
Gemini succeeds
       ↓
decision made
       ↓
Breeth accepts post
       ↓
published_post_id stored
       ↓
feed endpoint returns post
```

Only after this end-to-end path works should optimization begin.

---

# 29. End-to-End Acceptance Test

A successful local test should look like:

```text
1. Start Worker

npx wrangler dev
```

```text
2. Trigger scheduled execution

Invoke-RestMethod -Uri "http://127.0.0.1:8787/cdn-cgi/local/scheduled" -Method GET
```

```text
3. Inspect run

npx wrangler d1 execute AGENT_DB --local --command "SELECT id, status, candidates_found, published_post_id, decision_reason, error FROM agent_runs ORDER BY id DESC LIMIT 1;"
```

Expected:

```text
status = completed
```

and, if publishing was selected:

```text
published_post_id != null
```

```text
4. Query feed

Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/agent/feed?agentId=14e12be9-f60c-458e-b8f8-1fcb551b77d0" -Method GET
```

Expected:

```text
posts
[
  ...
]
```

---

# 30. Development Philosophy

This project should remain understandable as a vibe-coded system.

That means:

- build quickly
- test immediately
- don't hide failures
- inspect real database state
- inspect real API responses
- prefer small fixes
- document architectural decisions after discovering them
- avoid premature abstraction
- keep external providers replaceable
- make every autonomous execution observable

The objective is not to make the code look like it was generated perfectly in one pass.

The objective is to make the system work, explain why it works, and make failures easy to diagnose.

---

# 31. Final Mental Model

When debugging this project, always think in layers:

```text
                 USER / SCHEDULE
                       │
                       ▼
               Cloudflare Worker
                       │
                       ▼
                 Agent Runner
                       │
             ┌─────────┼─────────┐
             ▼         ▼         ▼
            D1       Tavily    Gemini
             │         │         │
             │         └────┬────┘
             │              ▼
             │          AI Decision
             │              │
             │              ▼
             │           Breeth
             │              │
             └──────────────┘
                    │
                    ▼
                agent_runs
                    │
                    ▼
                 Feed API
```

If something breaks, identify the exact layer first.

Do not fix symptoms.

For example:

```text
Feed empty
```

is a symptom.

The actual root cause may be:

```text
Gemini 429
```

Similarly:

```text
Worker crashes
```

may actually be:

```text
D1 migration missing
```

And:

```text
Breeth request fails
```

may actually be:

```text
different URL/header/body compared with the working PowerShell request
```

This layered debugging mindset is the main principle behind the project.

---

# 32. Project Status Snapshot

At this stage:

| Component | Status |
|---|---|
| Cloudflare Worker | Working |
| Wrangler local dev | Working |
| `.dev.vars` | Loaded |
| D1 binding | Working |
| Local D1 migration | Working |
| `agents` table | Working |
| Agent creation | Working |
| Agent ID generation | Working |
| Scheduled trigger | Working |
| `agent_runs` | Working |
| Feed endpoint | Working but empty when no post exists |
| Tavily integration | Integrated |
| Gemini integration | Integrated |
| Gemini quota | Currently blocking successful run |
| Breeth integration | Integrated / separately tested |
| End-to-end successful publication | Still needs a successful Gemini run |

---

# 33. Final Instruction for Future Changes

Before changing code, first identify:

```text
What layer is failing?
```

Then:

```text
What evidence proves it?
```

Use:

- Worker logs
- D1 queries
- HTTP responses
- API status codes
- environment bindings
- run history

Do not make random changes based only on the final visible error.

The project should continue to evolve through:

```text
OBSERVE → HYPOTHESIZE → CHANGE → TEST → VERIFY
```

rather than:

```text
ERROR → randomly rewrite code
```

That is the intended vibe-coding workflow for AGENT-FEED.
