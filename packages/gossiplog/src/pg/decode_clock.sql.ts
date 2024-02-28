export const decodeClockSql = String.raw`
DROP FUNCTION IF EXISTS decode_clock(k bytea);

CREATE OR REPLACE FUNCTION decode_clock(k bytea) RETURNS integer AS
$$
DECLARE
	sets integer[] := '{}';
	i integer;
	final integer := 0;
	base integer := 1;
BEGIN
	i := 0;
	WHILE i < length(k) LOOP
		sets := sets || (get_byte(k, i) & 127);
		EXIT WHEN (get_byte(k, i) & 128) = 0;
		i := i + 1;
	END LOOP;

	i := array_length(sets, 1);
	WHILE i > 0 LOOP
		final := final + sets[i] * base;
		base := base * 128;
		i := i - 1;
	END LOOP;

	RETURN final;
END;
$$ LANGUAGE plpgsql;`
