export const isAncestorSql = String.raw`
DROP FUNCTION IF EXISTS is_ancestor(BYTEA, BYTEA, BYTEA[]);
CREATE OR REPLACE FUNCTION is_ancestor(key_ BYTEA, ancestor_key BYTEA, visited BYTEA[] DEFAULT '{}'::BYTEA[]) RETURNS TABLE (ret_result boolean, ret_visited bytea[]) AS $$
DECLARE
  i jsonb;
  clock INTEGER;
  ancestor_clock INTEGER;
  index INTEGER;
  links jsonb;
  link bytea;
  newly_visited bytea[] = '{}';
  tmp_is_ancestor boolean;
  tmp_visited bytea[];
BEGIN
  IF key_ = ancestor_key THEN
    RETURN QUERY SELECT true, newly_visited;
    RETURN;
  END IF;

  clock := decode_clock(key_);
  ancestor_clock := decode_clock(ancestor_key);

  IF clock <= ancestor_clock THEN
    RETURN QUERY SELECT false, newly_visited;
    RETURN;
  END IF;

  index := FLOOR(LOG(2, clock - ancestor_clock));
  SELECT pgcbor_to_jsonb(value) INTO links FROM ancestors WHERE key = key_;

  FOR i in SELECT * FROM jsonb_array_elements(links[index]) LOOP
    link := decode((i->>0), 'hex');

    IF array_position(visited, link) IS NULL THEN
      visited := visited || link;

      SELECT * FROM is_ancestor(link, ancestor_key, visited) INTO tmp_is_ancestor, tmp_visited;
      SELECT array_agg(DISTINCT v) FROM unnest(newly_visited || tmp_visited) v INTO newly_visited;

      IF tmp_is_ancestor THEN
        RETURN QUERY SELECT true, newly_visited;
        RETURN;
      END IF;
    END IF;
  END LOOP;
  RETURN QUERY SELECT false, newly_visited;
END;
$$ LANGUAGE plpgsql;
`
