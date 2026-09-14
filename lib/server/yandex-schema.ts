export const yandexSchema = [
  `CREATE TABLE IF NOT EXISTS oauth_identities (provider TEXT NOT NULL, subject TEXT NOT NULL, participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE, created_at TEXT NOT NULL, PRIMARY KEY(provider,subject), UNIQUE(provider,participant_id))`,
  `CREATE TABLE IF NOT EXISTS oauth_flows (state_hash TEXT PRIMARY KEY NOT NULL, browser_hash TEXT NOT NULL, verifier TEXT NOT NULL, intent TEXT NOT NULL, next_path TEXT NOT NULL, origin TEXT NOT NULL, participant_id TEXT, session_id TEXT, expires_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_oauth_flows_expiry ON oauth_flows(expires_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_global_login ON participants(login) WHERE login IS NOT NULL`,
];
