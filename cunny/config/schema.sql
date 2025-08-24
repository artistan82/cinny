CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    device_id TEXT,
    endpoint TEXT UNIQUE,
    keys TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
