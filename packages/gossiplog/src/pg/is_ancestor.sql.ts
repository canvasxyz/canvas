export const isAncestorSql = String.raw`
DROP FUNCTION IF EXISTS is_ancestor(key_ BYTEA, ancestor_key BYTEA, recursing BOOLEAN);
CREATE OR REPLACE FUNCTION is_ancestor(key_ BYTEA, ancestor_key BYTEA, recursing BOOLEAN DEFAULT false) RETURNS boolean AS $$
DECLARE
  i jsonb;
  clock INTEGER;
  ancestor_clock INTEGER;
  index INTEGER;
  links jsonb;
  link bytea;
BEGIN
  IF NOT recursing THEN
    DROP TABLE IF EXISTS is_ancestor_visited;
  CREATE TEMP TABLE is_ancestor_visited (key BYTEA);
  END IF;

  IF key_ = ancestor_key THEN
    RETURN true;
  END IF;

  clock := decode_clock(key_);
  ancestor_clock := decode_clock(ancestor_key);

  IF clock <= ancestor_clock THEN
    RETURN false;
  END IF;

  index := FLOOR(LOG(2, clock - ancestor_clock));
  SELECT pgcbor_to_jsonb(value) INTO links FROM ancestors WHERE key = key_;

  FOR i in SELECT * FROM jsonb_array_elements(links[index]) LOOP
    link := decode((i->>0), 'hex');

    IF ((SELECT COUNT(*) FROM is_ancestor_visited WHERE key = link) = 0) THEN
      INSERT INTO is_ancestor_visited (key) VALUES (link);
      IF is_ancestor(link, ancestor_key) THEN
        RETURN true;
      END IF;
    END IF;
  END LOOP;
  RETURN false;
END;
$$ LANGUAGE plpgsql;
`
