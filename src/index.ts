import { runAgent, runAllAgents } from "./agent";
import { createAgent, getAgent, getFeed, getOnlyAgent } from "./db";
import { rememberAgentIdentity } from "./services/breeth";
import { createAgentConfig } from "./services/editorial";
import type { Env, InitRequest } from "./types";

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function validText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 200;
}

async function handleInit(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const existing = await getOnlyAgent(env);
  if (existing) {
    return json({ error: "agent_already_initialized" }, 409);
  }

  let body: InitRequest;
  try {
    body = (await request.json()) as InitRequest;
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  if (!body?.persona || !validText(body.persona.name) || !validText(body.persona.domain)) {
    return json({ error: "invalid_request" }, 400);
  }

  const name = body.persona.name.trim();
  const domain = body.persona.domain.trim();
  const agentId = crypto.randomUUID();
  const config = await createAgentConfig(env, name, domain);

  await createAgent(env, agentId, config);

  const agent = await getAgent(env, agentId);
    if (agent) {
    ctx.waitUntil((async () => {
      try {
        await rememberAgentIdentity(
          env,
          agentId,
          `${name} is an autonomous editorial persona focused on ${domain}. ` +
          `Mission: ${config.mission} Voice: ${config.voice.join(", ")}. ` +
          `Editorial principles: ${config.editorialPrinciples.join(" ")}`
        );
      } catch (error) {
        console.error("Breeth identity initialization failed", error);
      }
      await runAgent(env, agent);
    })());
  }

  // Exact evaluator response shape.
  return json({ agentId }, 201);
}

async function handleFeed(url: URL, env: Env): Promise<Response> {
  const agentId = url.searchParams.get("agentId");
  if (!agentId) return json({ error: "invalid_request" }, 400);

  const agent = await getAgent(env, agentId);
  if (!agent) return json({ posts: [] });

  const posts = await getFeed(env, agentId);
  return json({ posts });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/agent/init") {
      return handleInit(request, env, ctx);
    }

    if (request.method === "GET" && url.pathname === "/api/agent/feed") {
      return handleFeed(url, env);
    }

    return json({ error: "not_found" }, 404);
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(runAllAgents(env));
  },
};
