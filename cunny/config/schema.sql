CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    device_id TEXT,
    endpoint TEXT UNIQUE,
    keys TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS push_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    device_id TEXT,
    endpoint TEXT,
    keys TEXT,
    payload TEXT,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    next_try_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_attempt_at DATETIME,
    status_code INTEGER,
    error_text TEXT,
    dedupe_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Deduplication table with TTL semantics. Stores dedupe keys linked to a job and an expiry timestamp (epoch ms).
CREATE TABLE IF NOT EXISTS dedupe (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dedupe_key TEXT NOT NULL,
    endpoint TEXT,
    job_id INTEGER,
    expires_at INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dedupe_key_endpoint ON dedupe(dedupe_key, endpoint);
