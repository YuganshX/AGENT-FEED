PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS agents (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 domain TEXT NOT NULL,
 config_json TEXT NOT NULL,
 created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
 id TEXT PRIMARY KEY,
 agent_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 text TEXT NOT NULL,
 rationale TEXT NOT NULL,
 topic_key TEXT NOT. NULL,
 publish_score INTEGER NOT NULL,
 FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_posts_agent_created
 ON posts(agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_sources (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 post_id TEXT NOT NULL,
 url TEXT NOT NULL,
 FOREIGN KEY (post_id) REFERENCES posts(id)
);

CREATE INDEX IF NOT EXISTS idx_sources_post ON post_sources(post_id);

CREATE TABLE IF NOT EXISTS agent_runs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 agent_id TEXT NOT NULL,
 started_at TEXT NOT NULL,
 completed_at TEXT,
 status TEXT NOT NULL,
 candidates_found INTEGER NOT NULL DEFAULT 0,
 published_post_id TEXT,
 decision_reason TEXT,
 error TEXT,
 FOREIGN KEY (agent_id) REFERENCES agents(id)
);
