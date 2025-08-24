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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
