import type { AgentConfig, AgentRecord, Env, FeedPost } from "./types";

export async function getOnlyAgent(env: Env): Promise<AgentRecord | null> {
    return env.AGENT_DB.prepare(
        "SELECT id, name, domain, config_json, created_at FROM agents LIMIT 1"
    ).first<AgentRecord>();
}

export async function getAgent(env: Env, agentId: string): Promise<AgentRecord | null> {
    return env.AGENT_DB.prepare(
        "SELECT id, name, domain, config_json, created_at FROM agents WHERE id = ?"
    ).bind(agentId).first<AgentRecord>();
}

export async function createAgent(
    env: Env,
    agentId: string,
    config: AgentConfig
): Promise<void> {
    await env.AGENT_DB.prepare(
        `INSERT INTO agents (id, name, domain, config_json, created_at)
        VALUES (?, ?, ?, ?, ?)`
    ).bind(
        agentId,
        config.name,
        config.domain,
        JSON.stringify(config),
        new Date().toISOString()
    ).run();
}

export async function listAgents(env: Env): Promise<AgentRecord[]> {
    const result = await env.AGENT_DB.prepare(
        "SELECT id, name, domain, config_json, created_at FROM agents"
    ).all<AgentRecord>();
    return result.results;
}

export async function savePost(
    env: Env,
    input: {
        id: string;
        agentId: string;
        createdAt: string;
        text: string;
        rationale: string;
        topicKey: string;
        publishScore: number;
        sources: string[];
    }
): Promise<void> {
    const statements: D1PreparedStatement[] = [
        env.AGENT_DB.prepare(
            `INSERT INTO posts
                (id, agent_id, created_at, text, rationale, topic_key, publish_score)
                VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            input.id,
            input.agentId,
            input.createdAt,
            input.text,     
            input.rationale,
            input.topicKey,
            input.publishScore
        ),
        ...input.sources.map((url) =>
            env.AGENT_DB.prepare(
                "INSERT INTO post_sources (post_id, url) VALUES (?, ?)"
            ).bind(input.id, url)
        ),
    ];

    await env.AGENT_DB.batch(statements);
}

export async function getFeed(env: Env, agentId: string): Promise<FeedPost[]> {
    const posts = await env.AGENT_DB.prepare(
        `SELECT id, created_at, text, rationale
        FROM posts
        WHERE agent_id = ?
        ORDER BY created_at DESC`
    ).bind(agentId).all<{
        id: string;
        created_at: string;
        text: string;
        rationale: string;
    }>();

    const output: FeedPost[] = [];          
    for (const post of posts.results) {
        const sourceRows = await env.AGENT_DB.prepare(
            "SELECT url FROM post_sources WHERE post_id = ? ORDER BY id ASC"
        ).bind(post.id).all<{ url: string }>();

        output.push({
            id: post.id,
            createdAt: post.created_at,
            text: post.text,
            rationale: post.rationale,
            sources: sourceRows.results.map((row: any) => row.url),
        });
    }

    return output;
}

export async function createRun(env: Env, agentId: string): Promise<number> {
    const startedAt = new Date().toISOString();
    const result = await env.AGENT_DB.prepare(
        `INSERT INTO agent_runs (agent_id, started_at, status)
        VALUES (?, ?, 'running')`
    ).bind(agentId, startedAt).run();
    return Number(result.meta.last_row_id);
}

export async function finishRun(
    env: Env,
    runId: number,
    input: {
        status: "completed" | "failed";
        candidatesFound ?: number;
        publishedPostId ?: string;
        decisionReason ?: string;
        error ?: string;
    }
): Promise<void> {
    await env.AGENT_DB.prepare(
    `UPDATE agent_runs
    SET completed_at = ?, status = ?, candidates_found = ?,
        published_post_id = ?, decision_reason = ?, error = ?
    WHERE id = ?`
    ).bind(
        new Date().toISOString(),
        input.status,
        input.candidatesFound ?? 0,
        input.publishedPostId ?? null,
        input.decisionReason ?? null,
        input.error ?? null,
        runId
    ).run();
}