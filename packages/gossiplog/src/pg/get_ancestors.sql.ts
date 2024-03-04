export const getAncestorsSql = String.raw`
DROP FUNCTION IF EXISTS get_ancestors(BYTEA, INTEGER, BYTEA[]);
CREATE OR REPLACE FUNCTION get_ancestors(key_ BYTEA, at_or_before INTEGER, visited BYTEA[] DEFAULT ARRAY[]::BYTEA[]) RETURNS TABLE (ret_results bytea[], ret_newly_visited bytea[]) AS $$
DECLARE
  i jsonb;
  clock integer;
  index integer;
  links jsonb;
  link bytea;
  link_clock integer;
  results bytea[] = '{}';
  newly_visited bytea[] = '{}';
  tmp_results bytea[];
  tmp_newly_visited bytea[];
BEGIN
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
    ELSIF array_position(visited, link) IS NULL THEN
      visited := visited || link;
      SELECT * FROM get_ancestors(link, at_or_before, visited) INTO tmp_results, tmp_newly_visited;
       IF tmp_results IS NOT NULL THEN
        results := results || tmp_results;
      END IF;
      IF tmp_newly_visited IS NOT NULL THEN
        newly_visited := newly_visited || tmp_newly_visited;
      END IF;
    END IF;
  END LOOP;
  RETURN QUERY SELECT results, array_agg(DISTINCT v) FROM unnest(newly_visited) v;
END;
$$ LANGUAGE plpgsql;`
