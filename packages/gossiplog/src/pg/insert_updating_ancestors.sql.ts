export const insertSql = String.raw`
DROP FUNCTION IF EXISTS insert_updating_ancestors(BYTEA, BYTEA, BYTEA[], INTEGER[][]);

CREATE OR REPLACE FUNCTION insert_updating_ancestors(key_ BYTEA, value BYTEA, parents BYTEA[], ancestor_clocks INTEGER[]) RETURNS JSONB AS $$
DECLARE
  i integer := 1; -- ancestor_clocks is indexed from 1
  j integer;
  k integer;
  tmp jsonb;
  ancestor_clock integer;
  ancestor_links jsonb := '[]';
  ancestor_key bytea;
  child bytea;
  child_clock integer;
  new_clock integer;
  new_ancestors bytea[];
  links bytea[];
BEGIN
  WHILE i <= array_length(ancestor_clocks, 1) LOOP
    ancestor_clock := ancestor_clocks[i];

    IF i = 1 THEN
      -- ancestor_links is zero-indexed, [i] is implemented as [i-1], also encode bytea as hex
      SELECT array_to_json(array_agg(encode(tbl, 'hex')))::jsonb FROM unnest(parents) AS tbl INTO tmp;
      ancestor_links[i-1] := tmp;
    ELSE
      j := 0;
      links := '{}'::bytea[];
      -- i is one-indexed, [i-1] is implemented as [i-2]
      WHILE j < jsonb_array_length(ancestor_links[i-2]) LOOP
        child := decode(ancestor_links[i-2][j] #>> '{}', 'hex');
        child_clock := decode_clock(child);
        IF child_clock <= ancestor_clock THEN
          links := links || child;
        ELSE
          IF child_clock > ancestor_clocks[i-1] THEN
            RAISE EXCEPTION 'expected child_clock <= ancestor_clocks[i-1]';
          END IF;

          new_ancestors := get_ancestors(child, ancestor_clock);
          k := 1;
          WHILE k <= array_length(new_ancestors, 1) LOOP
            IF decode_clock(new_ancestors[k]) <= ancestor_clock THEN
              links := links || new_ancestors[k];
            END IF;
            k := k + 1;
          END LOOP;
        END IF;
        j := j + 1;
      END LOOP;

      SELECT array_to_json(array_agg(encode(tbl, 'hex')))::jsonb FROM unnest(links) AS tbl INTO tmp;
      ancestor_links[i-1] := tmp;
    END IF;

    i := i + 1;
  END LOOP;

  -- TODO: set ancestor_links to ancestors table
  RETURN ancestor_links;
END
$$ LANGUAGE plpgsql;`
