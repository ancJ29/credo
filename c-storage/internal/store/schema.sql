-- The end state, applied once to a new file (internal/sqlitedb). A record's
-- data is the JSON object a caller pushed.

CREATE TABLE services (
  code              TEXT NOT NULL PRIMARY KEY,
  -- Hex SHA-256 of the access key: a copy of this file holds no key.
  hashed_access_key TEXT NOT NULL
) STRICT;

CREATE TABLE records (
  service_code TEXT NOT NULL,
  key          TEXT NOT NULL,
  data         TEXT NOT NULL,
  PRIMARY KEY (service_code, key)
) STRICT;
