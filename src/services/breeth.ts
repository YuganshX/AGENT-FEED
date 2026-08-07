import type { Env, MemoryResult } from '../types';

function baseUrl(env: Env): string {
    return (env.BREETH_BASE_URL || "https://api.thebreeth.com").replace(/\/$/, "");
}

async function breethRequest<T>(
    env: Env,
    path: string,
    body: unknown
): Promise<T> {
    const response = await fetch(`${baseUrl(env)}${path}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env.BREETH_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Breeth ${path} failed (${response.status}): ${await response.text()}`);
    }

    return (await response.json()) as T;
}

export async function rememberAgentIdentity(
    env: Env,
    agentId: string,
    content: string
): Promise<void> {
    await breethRequest(env, "/v1/episodes", {
        content,
        group_id: agentId,
        source_description: "persona-init",
        extract_intent: true,
    });
}

export async function rememberPublishedPost(
    env: Env,
    agentId: string,
    input: {
        topickey: string;
        text: string;
        rationale: string;
        sources: string[];
    }
): Promise<void> {
    const content = [
        `Published topic: ${input.topickey}.`,
        `Post: ${input.text}`,
        `Editorial rationale: ${input.rationale}`,
        `Sources: ${input.sources.join(", ")}`,
    ].join("\n");

    await breethRequest(env, "/v1/episodes", {
        content,
        group_id: agentId,
        source_description: "published-post",
        extract_intent: false,
    });
}

export async function rememberEditorialDecision(
    env: Env,
    agentId: string,
    content: string,
    extractIntent = false
): Promise<void> {
    await breethRequest(env, "/v1/episodes", {
        content,
        group_id: agentId,
        source_description: "editorial-decision",
        extract_intent: extractIntent,
    });
}

export async function recallRelatedCoverage(
    env: Env,
    agentId: string,
    query: string,
    limit = 8
): Promise<MemoryResult[]>{
    const result = await breethRequest<{
        edges?: Array<{ fact?: string; intent_meta?: unknown}>;
    }>(env, "/v1/search", {
        query,
        group_id: agentId,
        limit,
    });

    return (result.edges || [])
    .filter((edge) => typeof edge.fact === "string")
    .map((edge) => ({ fact: edge.fact!, intentMeta: edge.intent_meta }));
}