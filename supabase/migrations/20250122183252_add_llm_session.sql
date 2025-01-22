CREATE TABLE chat_histories (
    user_id TEXT PRIMARY KEY,
    history JSONB NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);