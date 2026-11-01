-- Calibration results kept apart from authored content: reseeding never overwrites them.
ALTER TABLE items ADD COLUMN cal_b REAL;       -- difficulty estimated from student responses (logits)
ALTER TABLE items ADD COLUMN cal_n INTEGER;    -- responses behind the estimate
ALTER TABLE items ADD COLUMN cal_level TEXT;   -- level set by calibration (wins over the authored level on reseed)
