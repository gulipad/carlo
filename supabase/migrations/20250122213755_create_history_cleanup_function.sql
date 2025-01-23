CREATE OR REPLACE FUNCTION cleanup_chat_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM chat_histories
  WHERE last_updated < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql;