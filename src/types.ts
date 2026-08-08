export interface Env {
    AGENT_DB: D1Database;
    BREETH_API_KEY: string;
    GEMINI_API_KEY: string;
    TAVILY_API_KEY: string;
    GEMINI_MODEL?: string;
    BREETH_BASE_URL?: string;
    TAVILY_BASE_URL?: string;
}

export interface PersonaInput {
    name: string;
    domain: string;
}

export interface InitRequest {
    persona: PersonaInput;
}

export interface AgentConfig {
    name: string;
    domain: string;
    mission: string;
    voice: string[];
    editorialPrinciples: string[];
    discoveryQueries: string[];
    publishThreshold: number;
}

export interface AgentRecord {
    id: string;
    name: string;
    domain: string;
    config_json: string;
    created_at: string;
}

export interface Candidate {
    title: string;
    url: string;
    content: string;
    publishedAt?: string;
    scoreHint?: number;
}

export interface MemoryResult {
    fact: string;
    intentMeta?: unknown;
}

export interface EditorialDecision {
    publish: boolean;
    publishScore: number;
    selectedIndex: number | null;
    topicKey: string;
    rationale: string;
    angle: string;
}

export interface GeneratedPost {
    text: string;
    rationale: string;
}

export interface FeedPost {
    id: string;
    createdAt: string;
    text: string;
    rationale: string;
    sources: string[];
}