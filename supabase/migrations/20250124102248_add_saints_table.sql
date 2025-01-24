CREATE TABLE saints (
    id SERIAL PRIMARY KEY,           -- Unique identifier for each record
    month INT NOT NULL,              -- Month (1-12)
    day INT NOT NULL,                -- Day (1-31)
    saints TEXT,                     -- List of saints (comma-separated)
    link TEXT                        -- Reference link to the source
);