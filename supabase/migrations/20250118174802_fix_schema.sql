-- Allow `timezone` to be NULL
ALTER TABLE Users
ALTER COLUMN timezone DROP NOT NULL;

-- Allow `preferred_time` to be NULL
ALTER TABLE Users
ALTER COLUMN preferred_time DROP NOT NULL;

-- Ensure `subscribed` column has a default value of `false`
ALTER TABLE Users
ALTER COLUMN subscribed SET DEFAULT false;