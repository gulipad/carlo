CREATE TABLE bible_verses (
    id SERIAL PRIMARY KEY,          -- Unique identifier for each row
    book VARCHAR(100) NOT NULL,     -- Name of the book (e.g., Psalms, Genesis)
    chapter INT NOT NULL,           -- Chapter number (integer only)
    verse INT NOT NULL,             -- Verse number (integer only)
    verse_annotations VARCHAR(20),   -- Additional annotations for verses (e.g., "b", "a")
    text TEXT NOT NULL              -- The verse content
);