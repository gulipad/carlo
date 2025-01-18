CREATE TABLE Users (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(15) UNIQUE NOT NULL,
  timezone VARCHAR(50) NOT NULL,
  preferred_time TIME NOT NULL,
  subscribed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Gospels (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  content JSONB NOT NULL, -- JSONB to store structured Gospel data
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_phone_number ON Users (phone_number);
CREATE INDEX idx_gospels_date ON Gospels (date);