CREATE TABLE IF NOT EXISTS user_password_setup_tokens (
  password_setup_token_id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES user_accounts(user_id),
  purpose text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  issued_to_email text NOT NULL,
  requested_by_user_id text REFERENCES user_accounts(user_id),
  expires_at text NOT NULL,
  consumed_at text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS user_password_setup_tokens_user_id_idx
  ON user_password_setup_tokens(user_id);

CREATE INDEX IF NOT EXISTS user_password_setup_tokens_user_purpose_idx
  ON user_password_setup_tokens(user_id, purpose);
