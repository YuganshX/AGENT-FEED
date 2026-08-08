import {
    createRun,
    finishRun,
    listAgents,
    savePost
} from "./db";
import {
    recallRelatedCoverage,
    rememberEditorialDecision,
    rememberPublishedPost
} from "./services/breeth";
import { discoverCandidates } from "./services/discovery";
import { decideWhatToPublish, generatePost } from "./services/editorial";
import type { AgentConfig, AgentRecord, Env, MemoryResult } from "./types";

function parseConfig(agent: AgentRecord): AgentConfig {
    return JSON.parse(agent.config_json) as AgentConfig;
}

function uniqueId(prefix: string): string {
    return `${prefix}_${crypto.randomUUID()}`;
}

export async function runAgent(env: Env, agent: AgentRecord): Promise<void> {
    const runId = await createRun(env, agent.id);
    const config = parseConfig(agent);

    try{
        const candidates = await discoverCandidates(env, config);

        if(candidates.length === 0){
            await finishRun(env, runId, {
                status: "completed",
                candidatesFound: 0,
                decisionReason: "No discovery candidates were available",
            });
            return;
        }

        const retrievalQuery = candidates
            .slice(0, 8)
            .map((c) => c.title)
            .join("; ");

        let memories: MemoryResult[] = [];
        try{
            memories = await recallRelatedCoverage(
                env,
                agent.id,
                `Prior coverage or editorial decisions related to: ${retrievalQuery}`,
                10
            );
        }   catch (error){
            console.error("Breeth retrieval failed; continuing without memory", error);
        }

        const decision = await decideWhatToPublish(env, config, candidates, memories);

        const validIndex = 
            decision.selectedIndex !== null &&
            Number.isInteger(decision.selectedIndex) &&
            decision.selectedIndex >- 0 &&
            decision.selectedIndex < candidates.length;

            if(
                !decision.publish ||
                !validIndex ||
                decision.publishScore < config.publishThreshold
            ) {
                try {
                    await rememberEditorialDecision(
                        env,
                        agent.id,
                        `Skipped this cycle. Candidate set: ${candidates.slice(0, 5).map((c) => c.title).join(" | ")}. ` +
                            `Reason: ${decision.rationale}. Score: ${decision.publishScore}.`,
                        false
                    );
                } catch (error) {
                    console.error("Breeth skip memory failed", error);
                }

                await finishRun(env, runId, {
                    status: "completed",
                    candidatesFound: candidates.length,
                    decisionReason: decision.rationale,
                });
                return;
            }

            const candidate = candidates[decision.selectedIndex!];
            const generated = await generatePost(env, config, candidate, decision, memories);

            if(!generated.text?.trim() || !generated.rationale?.trim()) {
                throw new Error("Generated post failed validation");
            }

            const postId = uniqueId("post");
            const createdAt = new Date().toISOString();
            const sources = [candidate.url];

            await savePost(env, {
                id: postId,
                agentId: agent.id,
                createdAt,
                text: generated.text.trim(),
                rationale: generated.rationale.trim(),
                topicKey: decision.topicKey || candidate.title.slice(0, 100),
                publishScore: decision.publishScore,
                sources,
            });

            try {
                await rememberPublishedPost(env, agent.id, {
                    topickey: decision.topicKey,
                    text: generated.text.trim(),
                    rationale: generated.rationale.trim(),
                    sources,
                });
            } catch (error) {
                console.error("Breeth published-post memory failed", error);
            }

            await finishRun(env, runId, {
                status: "completed",
                candidatesFound: candidates.length,
                publishedPostId: postId,
                decisionReason: decision.rationale,
            });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Agent run failed", message);
        await finishRun(env, runId, {
            status: "failed",
            error: message.slice(0, 2000),
        });
    }
}

export async function runAllAgents(env: Env): Promise<void> {
    const agents = await listAgents(env);
    for (const agent of agents) {
        await runAgent(env, agent);
    }
}