export const getAncestorsSql = String.raw`
DROP FUNCTION IF EXISTS get_ancestors(key_ BYTEA, at_or_before INTEGER, recursing BOOLEAN);
CREATE OR REPLACE FUNCTION get_ancestors(key_ BYTEA, at_or_before INTEGER, recursing BOOLEAN DEFAULT false) RETURNS bytea[] AS $$
DECLARE
  i jsonb;
  clock integer;
  index integer;
  links jsonb;
  link bytea;
  link_clock integer;
  results bytea[];
  tmp bytea[];
BEGIN
  IF NOT recursing THEN
    DROP TABLE IF EXISTS get_ancestors_visited;
  CREATE TEMP TABLE get_ancestors_visited (key BYTEA);
  END IF;

  IF at_or_before <= 0 THEN
    RAISE EXCEPTION 'expected at_or_before > 0';
  END IF;

  clock := decode_clock(key_);
  IF at_or_before >= clock THEN
    RAISE EXCEPTION 'expected at_or_before < clock';
  END IF;

  index := FLOOR(LOG(2, clock - at_or_before));
  SELECT pgcbor_to_jsonb(value) INTO links FROM ancestors WHERE key = key_;

  FOR i in SELECT * FROM jsonb_array_elements(links[index]) LOOP
    link := decode((i->>0), 'hex');
    link_clock := decode_clock(link);

    IF link_clock <= at_or_before THEN
        results := results || link;
    ELSIF ((SELECT COUNT(*) FROM get_ancestors_visited WHERE key = link) = 0) THEN
      INSERT INTO get_ancestors_visited (key) VALUES (link);
      tmp := get_ancestors(link, at_or_before, TRUE);

      IF tmp IS NOT NULL THEN
        results := results || tmp;
      END IF;
    END IF;
  END LOOP;
  RETURN results;
END;
$$ LANGUAGE plpgsql;`
