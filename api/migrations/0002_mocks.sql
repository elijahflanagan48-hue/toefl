-- Full mock tests: fixed composition of bank items (content/mocks/mocks.json → seed/mocks.sql)
CREATE TABLE IF NOT EXISTS mocks (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  def        TEXT NOT NULL,      -- JSON {R:{M1,lower,upper}, L:{M1,lower,upper}, W:{bas,eml,dsc}, S:{lrp,int}} of item ids
  updated_at INTEGER NOT NULL
);
