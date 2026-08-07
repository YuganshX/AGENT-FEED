import type { AgentConfig, Candidate, Env } from "../types";

interface TavilyResult {
    title?: string;
    url?: string;
    content?: string;
    published_date?: string;
    score?: number;
}

export async function discoverCandidates(
    env: Env,
    config: AgentConfig
): Promise<Candidate[]>{
    if(!env.TAVILY_API_KEY){
        return [];
    }

    const base = (env.TAVILY_BASE_URL || "https://api.tavily.com").replace(/\$/,"");
    const collected: Candidate[] = [];

    for (const query of config.discoveryQueries.slice(0, 4)){
        const response = await fetch(`${base}/search`, {
            method: "POST",
            headers: { "Content-Type":"application/json" },
            body: JSON.stringify({
                api_key: env.TAVILY_API_KEY,
                query,
                topic: "news",
                search_depth: "advanced",
                max_results: 5,
                days: 3,
                include_answer: false,
                include_raw_content: false,
            }),
        });

        if(!response.ok) continue;

        const data = (await response.json()) as {results?: TavilyResult[] };
        for (const result of data.results || []){
            if (!result.url || !result.title) continue;
            collected.push({
                title: result.title,
                url: result.url,
                content: result.content || "",
                publishedAt: result.published_date,
                scoreHint: result.score,
            });
        }
    }

    const byUrl = new Map<string, Candidate>();
    for (const candidate of collected) {
        if(!byUrl.has(candidate.url)) byUrl.set(candidate.url, candidate);
    }

    return [...byUrl.values()].slice(0, 15);
}