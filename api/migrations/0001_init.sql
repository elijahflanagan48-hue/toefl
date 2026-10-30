-- NOEON TOEFL · initial schema (D1 / SQLite)
-- Times are unix milliseconds (INTEGER). JSON is stored as TEXT.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student','teacher','admin')),
  pass_hash     TEXT NOT NULL,            -- base64 PBKDF2-SHA256
  pass_salt     TEXT NOT NULL,            -- base64
  pass_iter     INTEGER NOT NULL,
  teacher_id    INTEGER REFERENCES users(id),   -- for students
  group_id      INTEGER REFERENCES groups(id),  -- for students
  target        REAL DEFAULT 4.5,               -- goal band 1–6
  exam_date     TEXT,                           -- YYYY-MM-DD
  must_reset    INTEGER NOT NULL DEFAULT 0,     -- teacher set a temporary password
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER
);
CREATE INDEX users_teacher ON users(teacher_id);

CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,           -- sha256(token), the token itself is never stored
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE groups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id  INTEGER NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,       -- invite code, e.g. NT-4K7Q
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);

-- Item bank. `body` is what the student sees; `key` never leaves the server
-- until the student has answered (learn mode) or the attempt is finished (exam mode).
CREATE TABLE items (
  id          TEXT PRIMARY KEY,           -- e.g. R-CTW-B-012
  section     TEXT NOT NULL CHECK (section IN ('R','L','W','S')),
  task        TEXT NOT NULL,              -- ctw | rdl | rap | lcr | lco | lan | lat | bas | eml | dsc | lrp | int
  level       TEXT NOT NULL CHECK (level IN ('A','B','C')),
  body        TEXT NOT NULL,              -- JSON
  key         TEXT,                       -- JSON (NULL for teacher-graded tasks)
  explain     TEXT,                       -- JSON: Russian explanations per question
  qtypes      TEXT,                       -- JSON array of question types
  b           REAL,                       -- Rasch difficulty (logits); seeded A=-1, B=0, C=+1
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','pretest','retired')),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX items_task ON items(section, task, level, status);

CREATE TABLE attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  kind         TEXT NOT NULL CHECK (kind IN ('practice','module','section','mock','diagnostic')),
  mode         TEXT NOT NULL DEFAULT 'learn' CHECK (mode IN ('learn','timed','mistakes','exam')),
  section      TEXT,                      -- R | L | W | S | NULL for full mock
  task         TEXT,
  assignment_id INTEGER REFERENCES assignments(id),
  route        TEXT,                      -- JSON: {"R":"upper","L":"lower"}
  threshold    REAL,                      -- routing threshold used
  raw          TEXT,                      -- JSON: {"R":{"got":28,"of":35}, ...}
  bands        TEXT,                      -- JSON: {"R":4.5,"W":4,"overall":4.5}
  started_at   INTEGER NOT NULL,
  finished_at  INTEGER
);
CREATE INDEX attempts_user ON attempts(user_id, started_at);

CREATE TABLE responses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id  INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  item_id     TEXT,                       -- NULL for built-in demo content
  section     TEXT,                       -- R | L | W | S
  q           INTEGER NOT NULL DEFAULT 0, -- question index inside the item (gap no. for CtW)
  module      INTEGER NOT NULL DEFAULT 1, -- MST module 1 or 2
  qtype       TEXT,
  answer      TEXT,                       -- JSON
  correct     INTEGER,                    -- 1/0, NULL until graded
  scored      INTEGER NOT NULL DEFAULT 1, -- 0 = pretest/unscored slot
  ms          INTEGER,                    -- time on question
  created_at  INTEGER NOT NULL,
  UNIQUE (attempt_id, section, item_id, q, module)
);
CREATE INDEX responses_item ON responses(item_id);

-- Writing / Speaking work that the teacher grades.
CREATE TABLE submissions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  attempt_id   INTEGER REFERENCES attempts(id),
  section      TEXT NOT NULL CHECK (section IN ('W','S')),
  task         TEXT NOT NULL,             -- eml | dsc | lrp | int
  item_id      TEXT,
  prompt       TEXT,                      -- JSON snapshot of the prompt shown
  text         TEXT,                      -- Writing answer
  words        INTEGER,
  parts        INTEGER NOT NULL DEFAULT 0,-- Speaking: number of audio parts
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft','pending','graded')),
  assignment_id INTEGER REFERENCES assignments(id),
  created_at   INTEGER NOT NULL,
  submitted_at INTEGER
);
CREATE INDEX submissions_status ON submissions(status, submitted_at);
CREATE INDEX submissions_user ON submissions(user_id);

CREATE TABLE audio (
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  part          INTEGER NOT NULL,         -- 0-based answer number
  r2_key        TEXT NOT NULL,
  mime          TEXT NOT NULL,
  bytes         INTEGER NOT NULL,
  duration_ms   INTEGER,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (submission_id, part)
);

CREATE TABLE ratings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  source        TEXT NOT NULL DEFAULT 'teacher' CHECK (source IN ('teacher','ai')),
  rater_id      INTEGER REFERENCES users(id),
  score         REAL NOT NULL,            -- 0–5 (Speaking: mean of parts)
  parts         TEXT,                     -- JSON array of per-part scores 0–5
  criteria      TEXT,                     -- JSON {criterion: true/false}
  comment       TEXT,
  marks         TEXT,                     -- JSON inline comments [{from,to,note}]
  is_final      INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL
);
CREATE INDEX ratings_sub ON ratings(submission_id);

CREATE TABLE assignments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id  INTEGER NOT NULL REFERENCES users(id),
  group_id    INTEGER REFERENCES groups(id),
  student_id  INTEGER REFERENCES users(id),
  title       TEXT NOT NULL,
  spec        TEXT NOT NULL,              -- JSON: {kind, section, task, count, mode}
  due_at      INTEGER,
  created_at  INTEGER NOT NULL
);

-- Teacher-level settings (routing threshold etc.)
CREATE TABLE settings (
  teacher_id  INTEGER PRIMARY KEY REFERENCES users(id),
  data        TEXT NOT NULL               -- JSON
);

-- Per-item calibration statistics (updated as responses arrive).
CREATE TABLE item_stats (
  item_id    TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  n          INTEGER NOT NULL DEFAULT 0,
  correct    INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
