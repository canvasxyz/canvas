CREATE TYPE pgcbor_next_state AS (remainder bytea, item jsonb);
CREATE OR REPLACE FUNCTION pgcbor_raise(message text, debug json, dummy_return_value anyelement)
RETURNS anyelement
LANGUAGE plpgsql
AS $$
BEGIN
IF debug IS NOT NULL THEN
  RAISE '% %', message, debug;
ELSE
  RAISE '%', message;
END IF;
END;
$$;
CREATE OR REPLACE FUNCTION pgcbor_decode(text,text)
RETURNS bytea
IMMUTABLE
STRICT
LANGUAGE sql AS $$
-- Wrapper-function to add base64url support to decode()
SELECT
CASE $1
  WHEN 'base64url' THEN pg_catalog.decode(rpad(translate($1,'-_','+/'),length($1) + (4 - length($1) % 4) % 4, '='),'base64')
  ELSE pg_catalog.decode($1,$2)
END
$$;
CREATE OR REPLACE FUNCTION pgcbor_encode(bytea,text)
RETURNS text
IMMUTABLE
STRICT
LANGUAGE sql AS $$
-- Wrapper-function to add base64url support to encode()
SELECT
CASE $1
  WHEN 'base64url' THEN translate(trim(trailing '=' from replace(pg_catalog.encode($1,'base64'),E'\n','')),'+/','-_')
  ELSE pg_catalog.encode($1,$2)
END
$$;
--
-- This function is meant to be replaced by the user if necessary,
-- to allow user-defined handling of CBOR types with no direct analogs in JSON.
--
-- https://tools.ietf.org/html/rfc8949#section-6.1
--
CREATE OR REPLACE FUNCTION pgcbor_infinity_value(sign boolean)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
RAISE EXCEPTION '%Infinity value has no direct analog in JSON.', CASE sign WHEN TRUE THEN '-' ELSE '' END
USING HINT = 'Replace pgcbor_infinity_value() with user-defined function returning a substitue value, e.g. JSON null, if Infinity values are expected and needs to be handled.',
      DETAIL = 'See: https://github.com/truthly/pg-cbor/blob/master/FUNCTIONS/infinity_value.sql for examples on such user-defined functions.';
END;
$$;

--
-- For inspiration, below are some alternative handlers for Infinity values.
--
-- WARNING:
-- Please understand that returning a substitute value will introduce
-- a new class of possible bugs due to ambiguity, which might be OK
-- or dangerous, depending on the situation.
--

/*
CREATE OR REPLACE FUNCTION pgcbor_infinity_value(sign boolean)
RETURNS jsonb
LANGUAGE sql
AS $$
SELECT 'null'::jsonb;
$$;
*/

/*
CREATE OR REPLACE FUNCTION pgcbor_infinity_value(sign boolean)
RETURNS jsonb
LANGUAGE sql
AS $$
SELECT CASE WHEN sign THEN '"-Infinity"'::jsonb ELSE '"Infinity"'::jsonb END
$$;
*/--
-- This function is meant to be replaced by the user if necessary,
-- to allow user-defined handling of CBOR types with no direct analogs in JSON.
--
-- https://tools.ietf.org/html/rfc8949#section-6.1
--
CREATE OR REPLACE FUNCTION pgcbor_nan_value()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
RAISE EXCEPTION 'NaN value has no direct analog in JSON.'
USING HINT = 'Replace pgcbor_nan_value() with user-defined function returning a substitue value, e.g. JSON null, if NaN values are expected and needs to be handled.',
      DETAIL = 'See: https://github.com/truthly/pg-cbor/blob/master/FUNCTIONS/nan_value.sql for examples on such user-defined functions.';
END;
$$;

--
-- For inspiration, below are some alternative handlers for NaN values.
--
-- WARNING:
-- Please understand that returning a substitute value will introduce
-- a new class of possible bugs due to ambiguity, which might be OK
-- or dangerous, depending on the situation.
--

/*
CREATE OR REPLACE FUNCTION pgcbor_nan_value()
RETURNS jsonb
LANGUAGE sql
AS $$
SELECT 'null'::jsonb;
$$;
*/

/*
CREATE OR REPLACE FUNCTION pgcbor_nan_value()
RETURNS jsonb
LANGUAGE sql
AS $$
SELECT '"NaN"'::jsonb;
$$;
*/
--
-- This function is meant to be replaced by the user if necessary,
-- to allow user-defined handling of CBOR types with no direct analogs in JSON.
--
-- https://tools.ietf.org/html/rfc8949#section-6.1
--
CREATE OR REPLACE FUNCTION pgcbor_undefined_value()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
RAISE EXCEPTION 'Undefined value has no direct analog in JSON.'
USING HINT = 'Replace pgcbor_undefined_value() with user-defined function returning a substitue value, e.g. JSON null, if Undefined values are expected and needs to be handled.',
      DETAIL = 'See: https://github.com/truthly/pg-cbor/blob/master/FUNCTIONS/undefined_value.sql for examples on such user-defined functions.';
END;
$$;

--
-- For inspiration, below are some alternative handlers for Undefined values.
--
-- WARNING:
-- Please understand that returning a substitute value will introduce
-- a new class of possible bugs due to ambiguity, which might be OK
-- or dangerous, depending on the situation.
--

/*
CREATE OR REPLACE FUNCTION pgcbor_undefined_value()
RETURNS jsonb
LANGUAGE sql
AS $$
SELECT 'null'::jsonb;
$$;
*/

/*
CREATE OR REPLACE FUNCTION pgcbor_undefined_value()
RETURNS jsonb
LANGUAGE sql
AS $$
SELECT '"Undefined"'::jsonb;
$$;
*/--
-- This function is meant to be replaced by the user,
-- to allow special handling of CBOR types with no direct analogs in JSON.
--
-- https://tools.ietf.org/html/rfc8949#section-6.1
--
CREATE OR REPLACE FUNCTION pgcbor_substitute_value(cbor bytea, major_type integer, additional_type integer)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
RAISE EXCEPTION 'major_type % additional_type % has no direct analog in JSON.', major_type, additional_type
USING HINT = 'Replace pgcbor_substitute_value() with user-defined function returning a substitue value, e.g. JSON null, if such values are expected and needs to be handled.',
      DETAIL = 'See: https://github.com/truthly/pg-cbor/blob/master/FUNCTIONS/substitute_value.sql for examples on such user-defined functions.';
END;
$$;

--
-- For inspiration, below are some alternative handlers for Undefined values.
--
-- WARNING:
-- Please understand that returning a substitute value will introduce
-- a new class of possible bugs due to ambiguity, which might be OK
-- or dangerous, depending on the situation.
--

/*
CREATE OR REPLACE FUNCTION pgcbor_substitute_value(cbor bytea, major_type integer, additional_type integer)
RETURNS jsonb
LANGUAGE sql
AS $$
SELECT 'null'::jsonb;
$$;
*/

/*
CREATE OR REPLACE FUNCTION pgcbor_substitute_value(cbor bytea, major_type integer, additional_type integer)
RETURNS jsonb
LANGUAGE sql
AS $$
SELECT jsonb_build_object('major_type',major_type,'additional_type',additional_type);
$$;
*/CREATE OR REPLACE FUNCTION pgcbor_bytea_to_numeric(val bytea)
RETURNS numeric
IMMUTABLE STRICT
LANGUAGE plpgsql
AS $$
DECLARE
n numeric := 0;
BEGIN
FOR i IN 0 .. length(val)-1 LOOP
  n := n*256 + get_byte(val,i);
END LOOP;
RETURN n;
END;
$$;
CREATE OR REPLACE FUNCTION pgcbor_numeric_to_bytea(n numeric)
RETURNS bytea
IMMUTABLE STRICT
LANGUAGE plpgsql
AS $$
DECLARE
b BYTEA := '\x';
v INTEGER;
BEGIN
WHILE n > 0 LOOP
  v := n % 256;
  b := set_byte(('\x00' || b),0,v);
  n := (n-v)/256;
END LOOP;
RETURN b;
END;
$$;
CREATE OR REPLACE FUNCTION pgcbor_next_float_half(cbor bytea)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE plpgsql
AS $$
-- https://tools.ietf.org/html/rfc7049#appendix-D
DECLARE
sign boolean;
half int := (get_byte(cbor,0) << 8) + get_byte(cbor,1);
exp int := (half >> 10) & x'1f'::int;
mant int := half & x'3ff'::int;
val float8;
BEGIN
sign := (half & x'8000'::int) != 0;
IF exp = 0 THEN
  val := mant * 2^(-24);
ELSIF exp != 31 THEN
  val := (mant + 1024) * 2^(exp-25);
ELSIF mant = 0 THEN
    RETURN ROW(substring(cbor,3), pgcbor_infinity_value(sign))::pgcbor_next_state;
ELSE
    RETURN ROW(substring(cbor,3), pgcbor_nan_value())::pgcbor_next_state;
END IF;
IF sign THEN
  val := -val;
END IF;
RETURN ROW(substring(cbor,3), pg_catalog.to_jsonb(val))::pgcbor_next_state;
END;
$$;
CREATE OR REPLACE FUNCTION pgcbor_next_float_single(cbor bytea)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE plpgsql
AS $$
DECLARE
single bit(32) := get_byte(cbor,0)::bit(8) ||
                  get_byte(cbor,1)::bit(8) ||
                  get_byte(cbor,2)::bit(8) ||
                  get_byte(cbor,3)::bit(8);
/*
00000000011111111112222222222333
12345678901234567890123456789012
seeeeeeeefffffffffffffffffffffff
^-sign (1 bit)
 ^-exponent (8 bits)
         ^-fraction (23 bits)
*/
sign boolean := get_bit(single, 0)::integer::boolean;
exponent integer := substring(single from 2 for 8)::integer;
fraction integer := substring(single from 10 for 23)::integer;
frac float8 := (fraction | (1::integer << 23))::float8 / (2::integer << 23)::float8;
value float8;
BEGIN
IF exponent = b'11111111'::integer THEN
  IF fraction = b'00000000000000000000000'::integer THEN
    RETURN ROW(substring(cbor,5), pgcbor_infinity_value(sign))::pgcbor_next_state;
  ELSE
    RETURN ROW(substring(cbor,5), pgcbor_nan_value())::pgcbor_next_state;
  END IF;
END IF;
value := frac * 2::float8^(exponent-126);
IF sign THEN
  value := -value;
END IF;
RETURN ROW(substring(cbor,5), pg_catalog.to_jsonb(value))::pgcbor_next_state;
END;
$$;
CREATE OR REPLACE FUNCTION pgcbor_next_float_double(cbor bytea)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE plpgsql
AS $$
DECLARE
double bit(64) := get_byte(cbor,0)::bit(8) ||
                  get_byte(cbor,1)::bit(8) ||
                  get_byte(cbor,2)::bit(8) ||
                  get_byte(cbor,3)::bit(8) ||
                  get_byte(cbor,4)::bit(8) ||
                  get_byte(cbor,5)::bit(8) ||
                  get_byte(cbor,6)::bit(8) ||
                  get_byte(cbor,7)::bit(8);
/*
0000000001111111111222222222233333333334444444444555555555566666
1234567890123456789012345678901234567890123456789012345678901234
seeeeeeeeeeeffffffffffffffffffffffffffffffffffffffffffffffffffff
^-sign (1 bit)
 ^-exponent (11 bits)
            ^-fraction (52 bits)
*/
sign boolean := get_bit(double, 0)::integer::boolean;
exponent integer := substring(double from 2 for 11)::integer;
fraction bigint := substring(double from 13 for 52)::bigint;
frac float8 := (fraction | (1::bigint << 52))::float8 / (2::bigint << 52)::float8;
value float8;
BEGIN
IF exponent = b'11111111111'::integer THEN
  IF fraction = b'0000000000000000000000000000000000000000000000000000'::bigint THEN
    RETURN ROW(substring(cbor,9), pgcbor_infinity_value(sign))::pgcbor_next_state;
  ELSE
    RETURN ROW(substring(cbor,9), pgcbor_nan_value())::pgcbor_next_state;
  END IF;
END IF;
value := frac * 2::float8^(exponent-1022);
IF sign THEN
  value := -value;
END IF;
RETURN ROW(substring(cbor,9), pg_catalog.to_jsonb(value))::pgcbor_next_state;
END;
$$;
CREATE OR REPLACE FUNCTION pgcbor_major_type_0(
cbor bytea,
encode_binary_format text,
additional_type integer,
length_bytes integer,
data_value numeric
)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE plpgsql
AS $$
BEGIN
IF additional_type <= 27 THEN
  RETURN ROW(substring(cbor,2+length_bytes), pg_catalog.to_jsonb(data_value));
ELSIF additional_type >= 28 AND additional_type <= 30 THEN
  RAISE EXCEPTION 'a reserved value is used for additional information(%)', additional_type;
ELSIF additional_type = 31 THEN
  RAISE EXCEPTION 'additional information 31 used with major type 0';
ELSE
  RAISE EXCEPTION 'not implemented, major_type %, additional_type %', 0, additional_type;
END IF;
END;
$$;
CREATE OR REPLACE FUNCTION pgcbor_major_type_1(
cbor bytea,
encode_binary_format text,
additional_type integer,
length_bytes integer,
data_value numeric
)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE plpgsql
AS $$
BEGIN
IF additional_type <= 27 THEN
  RETURN ROW(substring(cbor,2+length_bytes), pg_catalog.to_jsonb(-1-data_value));
ELSIF additional_type >= 28 AND additional_type <= 30 THEN
  RAISE EXCEPTION 'a reserved value is used for additional information(%)', additional_type;
ELSIF additional_type = 31 THEN
  RAISE EXCEPTION 'additional information 31 used with major type 1';
ELSE
  RAISE EXCEPTION 'not implemented, major_type %, additional_type %', 1, additional_type;
END IF;
END;
$$;
CREATE OR REPLACE FUNCTION pgcbor_major_type_2(
cbor bytea,
encode_binary_format text,
additional_type integer,
length_bytes integer,
data_value numeric
)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE plpgsql
AS $$
BEGIN
IF additional_type <= 27 THEN
  RETURN ROW(substring(cbor,2+length_bytes+data_value::integer), pg_catalog.to_jsonb(pgcbor_encode(substring(cbor,2+length_bytes,data_value::integer),encode_binary_format)));
ELSIF additional_type = 31 THEN
  RETURN pgcbor_next_indefinite_byte_string(substring(cbor,2), encode_binary_format);
ELSIF additional_type >= 28 AND additional_type <= 30 THEN
  RAISE EXCEPTION 'a reserved value is used for additional information(%)', additional_type;
ELSE
  RAISE EXCEPTION 'not implemented, major_type %, additional_type %', 2, additional_type;
END IF;
END;
$$;
CREATE OR REPLACE FUNCTION pgcbor_major_type_3(
cbor bytea,
encode_binary_format text,
additional_type integer,
length_bytes integer,
data_value numeric
)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE plpgsql
AS $$
BEGIN
IF additional_type <= 27 THEN
  RETURN ROW(substring(cbor,2+length_bytes+data_value::integer), pg_catalog.to_jsonb(convert_from(substring(cbor,2+length_bytes,data_value::integer),'utf8')));
ELSIF additional_type = 31 THEN
  RETURN pgcbor_next_indefinite_text_string(substring(cbor,2), encode_binary_format);
ELSIF additional_type >= 28 AND additional_type <= 30 THEN
  RAISE EXCEPTION 'a reserved value is used for additional information(%)', additional_type;
ELSE
  RAISE EXCEPTION 'not implemented, major_type %, additional_type %', 3, additional_type;
END IF;
END;
$$;
CREATE OR REPLACE FUNCTION pgcbor_major_type_4(
cbor bytea,
encode_binary_format text,
additional_type integer,
length_bytes integer,
data_value numeric
)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE plpgsql
AS $$
BEGIN
IF additional_type <= 27 THEN
  RETURN pgcbor_next_array(substring(cbor,2+length_bytes), data_value::integer, encode_binary_format);
ELSIF additional_type = 31 THEN
  RETURN pgcbor_next_indefinite_array(substring(cbor,2), encode_binary_format);
ELSIF additional_type >= 28 AND additional_type <= 30 THEN
  RAISE EXCEPTION 'a reserved value is used for additional information(%)', additional_type;
ELSE
  RAISE EXCEPTION 'not implemented, major_type %, additional_type %', 4, additional_type;
END IF;
END;
$$;
CREATE OR REPLACE FUNCTION pgcbor_major_type_5(
cbor bytea,
encode_binary_format text,
additional_type integer,
length_bytes integer,
data_value numeric
)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE plpgsql
AS $$
BEGIN
IF additional_type <= 27 THEN
  RETURN pgcbor_next_map(substring(cbor,2+length_bytes), data_value::integer, encode_binary_format);
ELSIF additional_type = 31 THEN
  RETURN pgcbor_next_indefinite_map(substring(cbor,2), encode_binary_format);
ELSIF additional_type >= 28 AND additional_type <= 30 THEN
  RAISE EXCEPTION 'a reserved value is used for additional information(%)', additional_type;
ELSE
  RAISE EXCEPTION 'not implemented, major_type %, additional_type %', 5, additional_type;
END IF;
END;
$$;
CREATE OR REPLACE FUNCTION pgcbor_major_type_6(
cbor bytea,
encode_binary_format text,
additional_type integer,
length_bytes integer,
data_value numeric
)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE plpgsql
AS $$
BEGIN
IF additional_type = 2 THEN
  RETURN (
    SELECT
      ROW(tag_item.remainder, pg_catalog.to_jsonb(pgcbor_bytea_to_numeric(decode(tag_item.item#>>'{}','hex'))))
    FROM pgcbor_next_item(substring(cbor,2), encode_binary_format) AS tag_item
  );
ELSIF additional_type = 3 THEN
  RETURN (
    SELECT ROW(tag_item.remainder, pg_catalog.to_jsonb(-1-pgcbor_bytea_to_numeric(decode(tag_item.item#>>'{}','hex'))))
    FROM pgcbor_next_item(substring(cbor,2), encode_binary_format) AS tag_item
  );
ELSIF additional_type = 21 THEN
  RETURN pgcbor_next_item(substring(cbor,2), 'base64url');
ELSIF additional_type = 22 THEN
  RETURN pgcbor_next_item(substring(cbor,2), 'base64');
ELSIF additional_type = 23 THEN
  RETURN pgcbor_next_item(substring(cbor,2), 'hex');
ELSIF additional_type = ANY(ARRAY[0,1,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,24,25,26,27]) THEN
  RETURN pgcbor_next_tag(substring(cbor,2+length_bytes), data_value, encode_binary_format);
ELSIF additional_type >= 28 AND additional_type <= 30 THEN
  RAISE EXCEPTION 'a reserved value is used for additional information(%)', additional_type;
ELSIF additional_type = 31 THEN
  RAISE EXCEPTION 'additional information 31 used with major type 6';
ELSE
  RAISE EXCEPTION 'not implemented, major_type %, additional_type %', 6, additional_type;
END IF;
END;
$$;
CREATE OR REPLACE FUNCTION pgcbor_major_type_7(
cbor bytea,
encode_binary_format text,
additional_type integer,
length_bytes integer,
data_value numeric
)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE plpgsql
AS $$
BEGIN
IF additional_type = 20 THEN
  RETURN ROW(substring(cbor,2), pg_catalog.to_jsonb(false));
ELSIF additional_type = 21 THEN
  RETURN ROW(substring(cbor,2), pg_catalog.to_jsonb(true));
ELSIF additional_type = 22 THEN
  RETURN ROW(substring(cbor,2), 'null'::jsonb);
ELSIF additional_type = 25 THEN
  RETURN pgcbor_next_float_half(substring(cbor,2));
ELSIF additional_type = 26 THEN
  RETURN pgcbor_next_float_single(substring(cbor,2));
ELSIF additional_type = 27 THEN
  RETURN pgcbor_next_float_double(substring(cbor,2));
ELSIF additional_type = 23 THEN
  RETURN ROW(substring(cbor,2), pgcbor_undefined_value());
ELSIF additional_type = 24 AND data_value >= 32 THEN
  RETURN ROW(substring(cbor,2+length_bytes), pg_catalog.to_jsonb(data_value));
ELSIF additional_type <= 19 THEN
  RETURN ROW(substring(cbor,2+length_bytes), pg_catalog.to_jsonb(data_value));
ELSIF additional_type > 27 AND additional_type < 31 THEN
  RETURN ROW(substring(cbor,2), pgcbor_substitute_value(substring(cbor,2), 7, additional_type));
ELSIF additional_type = 31 THEN
  RAISE EXCEPTION '"break" stop code appeared where a data item is expected, the enclosing item is not well-formed';
ELSIF additional_type = 24 AND data_value < 32 THEN
  RAISE EXCEPTION 'major type 7, additional information 24, data_value(%) < 32 (incorrect)', data_value;
ELSIF additional_type >= 28 AND additional_type <= 30 THEN
  RAISE EXCEPTION 'a reserved value is used for additional information(%)', additional_type;
ELSE
  RAISE EXCEPTION 'not implemented, major_type %, additional_type %', 7, additional_type;
END IF;
END;
$$;
CREATE OR REPLACE FUNCTION pgcbor_next_item(cbor bytea, encode_binary_format text)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE plpgsql
AS $$
DECLARE
major_type constant integer := (get_byte(cbor,0) >> 5) & '111'::bit(3)::integer;
additional_type constant integer :=  get_byte(cbor,0) & '11111'::bit(5)::integer;
length_bytes constant integer := NULLIF(LEAST(floor(2 ^ (additional_type - 24))::integer,16),16);
data_value numeric := 0;
BEGIN
IF additional_type <= 23 THEN
  data_value := additional_type::numeric;
ELSIF additional_type BETWEEN 24 AND 27 THEN
/*
  FOR byte_pos IN 1..length_bytes LOOP
    data_value := data_value + get_byte(cbor,byte_pos) * 2::numeric^(8*(length_bytes-byte_pos));
  END LOOP;
  data_value := floor(data_value);
*/
  SELECT
    floor(SUM(get_byte(cbor,byte_pos) * 2::numeric^(8*(length_bytes-byte_pos))))
  INTO data_value
  FROM generate_series(1,length_bytes) AS byte_pos;
END IF;
--
-- Sorted by observed frequency from real-life WebAuthn examples
-- to hit the matching case as early as possible.
--
IF    major_type = 3 THEN RETURN pgcbor_major_type_3(cbor,encode_binary_format,additional_type,length_bytes,data_value);
ELSIF major_type = 5 THEN RETURN pgcbor_major_type_5(cbor,encode_binary_format,additional_type,length_bytes,data_value);
ELSIF major_type = 1 THEN RETURN pgcbor_major_type_1(cbor,encode_binary_format,additional_type,length_bytes,data_value);
ELSIF major_type = 2 THEN RETURN pgcbor_major_type_2(cbor,encode_binary_format,additional_type,length_bytes,data_value);
ELSIF major_type = 4 THEN RETURN pgcbor_major_type_4(cbor,encode_binary_format,additional_type,length_bytes,data_value);
ELSIF major_type = 0 THEN RETURN pgcbor_major_type_0(cbor,encode_binary_format,additional_type,length_bytes,data_value);
ELSIF major_type = 6 THEN RETURN pgcbor_major_type_6(cbor,encode_binary_format,additional_type,length_bytes,data_value);
ELSIF major_type = 7 THEN RETURN pgcbor_major_type_7(cbor,encode_binary_format,additional_type,length_bytes,data_value);
ELSE
  RAISE EXCEPTION 'not implemented, major_type %, additional_type %', major_type, additional_type;
END IF;
END;
$$;
CREATE OR REPLACE FUNCTION pgcbor_next_array(cbor bytea, item_count integer, encode_binary_format text)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE sql
AS $$
WITH RECURSIVE x AS (
  SELECT
    pgcbor_next_array.cbor AS remainder,
    pgcbor_next_array.item_count,
    jsonb_build_array() AS jsonb_array
  UNION ALL
  SELECT
    pgcbor_next_item.remainder,
    x.item_count-1,
    x.jsonb_array || jsonb_build_array(pgcbor_next_item.item)
  FROM x
  JOIN LATERAL pgcbor_next_item(x.remainder, encode_binary_format) ON TRUE
  WHERE x.item_count > 0
)
SELECT ROW(x.remainder, x.jsonb_array)::pgcbor_next_state FROM x WHERE x.item_count = 0
$$;
CREATE OR REPLACE FUNCTION pgcbor_next_map(cbor bytea, item_count integer, encode_binary_format text)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE sql
AS $$
WITH RECURSIVE x AS (
  SELECT
    pgcbor_next_map.cbor AS remainder,
    pgcbor_next_map.item_count,
    jsonb_build_object() AS map
  UNION ALL
  SELECT
    map_value.remainder,
    x.item_count-1,
    x.map || jsonb_build_object(map_key.item#>>'{}', map_value.item)
  FROM x
  JOIN LATERAL pgcbor_next_item(x.remainder, encode_binary_format) AS map_key ON TRUE
  JOIN LATERAL pgcbor_next_item(map_key.remainder, encode_binary_format) AS map_value ON TRUE
  WHERE x.item_count > 0
)
SELECT ROW(x.remainder, x.map)::pgcbor_next_state FROM x WHERE x.item_count = 0
$$;
CREATE OR REPLACE FUNCTION pgcbor_next_indefinite_array(cbor bytea, encode_binary_format text)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE sql
AS $$
WITH RECURSIVE x AS (
  SELECT
    0 AS i,
    pgcbor_next_indefinite_array.cbor AS remainder,
    jsonb_build_array() AS jsonb_array
  UNION ALL
  SELECT
    x.i + 1,
    pgcbor_next_item.remainder,
    x.jsonb_array || jsonb_build_array(pgcbor_next_item.item)
  FROM x
  JOIN LATERAL pgcbor_next_item(x.remainder, encode_binary_format) ON TRUE
  WHERE get_byte(x.remainder,0) <> 255
)
SELECT ROW(substring(x.remainder,2), x.jsonb_array)::pgcbor_next_state FROM x ORDER BY i DESC LIMIT 1
$$;
CREATE OR REPLACE FUNCTION pgcbor_next_indefinite_map(cbor bytea, encode_binary_format text)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE sql
AS $$
WITH RECURSIVE x AS (
  SELECT
    0 AS i,
    pgcbor_next_indefinite_map.cbor AS remainder,
    jsonb_build_object() AS map
  UNION ALL
  SELECT
    x.i + 1,
    map_value.remainder,
    x.map || jsonb_build_object(map_key.item#>>'{}', map_value.item)
  FROM x
  JOIN LATERAL pgcbor_next_item(x.remainder, encode_binary_format) AS map_key ON TRUE
  JOIN LATERAL pgcbor_next_item(map_key.remainder, encode_binary_format) AS map_value ON TRUE
  WHERE get_byte(x.remainder,0) <> 255
)
SELECT ROW(substring(x.remainder,2), x.map)::pgcbor_next_state FROM x ORDER BY i DESC LIMIT 1
$$;
CREATE OR REPLACE FUNCTION pgcbor_next_indefinite_byte_string(cbor bytea, encode_binary_format text)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE sql
AS $$
WITH RECURSIVE x AS (
  SELECT
    0 AS i,
    pgcbor_next_indefinite_byte_string.cbor AS remainder,
    '\x'::bytea AS bytes
  UNION ALL
  SELECT
    x.i + 1,
    pgcbor_next_item.remainder,
    x.bytes || CASE
      WHEN (get_byte(x.remainder,0)>>5)&'111'::bit(3)::integer = 2
      THEN pgcbor_decode((pgcbor_next_item.item#>>'{}'),encode_binary_format)
      ELSE pgcbor_raise('incorrect substructure of indefinite-length byte string (may only contain definite-length strings of the same major type)',NULL,NULL::bytea)
    END
  FROM x
  JOIN LATERAL pgcbor_next_item(x.remainder, encode_binary_format) ON TRUE
  WHERE get_byte(x.remainder,0) <> 255
)
SELECT ROW(substring(x.remainder,2), to_jsonb(pgcbor_encode(x.bytes,encode_binary_format)))::pgcbor_next_state FROM x ORDER BY i DESC LIMIT 1
$$;
CREATE OR REPLACE FUNCTION pgcbor_next_indefinite_text_string(cbor bytea, encode_binary_format text)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE sql
AS $$
WITH RECURSIVE x AS (
  SELECT
    0 AS i,
    pgcbor_next_indefinite_text_string.cbor AS remainder,
    ''::text AS text_string
  UNION ALL
  SELECT
    x.i + 1,
    pgcbor_next_item.remainder,
    x.text_string || CASE
      WHEN (get_byte(x.remainder,0)>>5)&'111'::bit(3)::integer = 3
      THEN (pgcbor_next_item.item#>>'{}')
      ELSE pgcbor_raise('incorrect substructure of indefinite-length text string (may only contain definite-length strings of the same major type)',NULL,NULL::text)
    END
  FROM x
  JOIN LATERAL pgcbor_next_item(x.remainder, encode_binary_format) ON TRUE
  WHERE get_byte(x.remainder,0) <> 255
)
SELECT ROW(substring(x.remainder,2), to_jsonb(x.text_string))::pgcbor_next_state FROM x ORDER BY i DESC LIMIT 1
$$;
CREATE OR REPLACE FUNCTION pgcbor_next_tag(cbor bytea, tag_number numeric, encode_binary_format text)
RETURNS pgcbor_next_state
IMMUTABLE
LANGUAGE sql
AS $$
SELECT
CASE
WHEN tag_number = 0 AND (pgcbor_next_item.item#>>'{}')::timestamptz IS NOT NULL THEN pgcbor_next_item
ELSE pgcbor_next_item
END
FROM pgcbor_next_item(cbor, encode_binary_format)
$$;
CREATE OR REPLACE FUNCTION pgcbor_to_jsonb(
  cbor bytea,
  encode_binary_format text DEFAULT 'hex'
)
RETURNS jsonb
STRICT
IMMUTABLE
LANGUAGE sql
AS $$
SELECT
  CASE
    WHEN length(remainder) = 0
    THEN item
    ELSE pgcbor_raise('Multiple root level CBOR items. Use to_jsonb_array() instead if this is expected.',NULL,NULL::jsonb)
  END
FROM pgcbor_next_item(pgcbor_to_jsonb.cbor, encode_binary_format)
$$;
CREATE OR REPLACE FUNCTION pgcbor_to_jsonb_array(
  cbor bytea,
  encode_binary_format text DEFAULT 'hex'
)
RETURNS jsonb
STRICT
IMMUTABLE
LANGUAGE sql
AS $$
WITH RECURSIVE x AS (
  SELECT
    0 AS i,
    pgcbor_next_item.remainder,
    pgcbor_next_item.item
  FROM pgcbor_next_item(pgcbor_to_jsonb_array.cbor, encode_binary_format)
  UNION ALL
  SELECT
    x.i + 1,
    pgcbor_next_item.remainder,
    pgcbor_next_item.item
  FROM x
  JOIN LATERAL pgcbor_next_item(x.remainder, encode_binary_format) ON TRUE
  WHERE length(x.remainder) > 0
)
SELECT
  CASE
    WHEN length(cbor) = 0
    THEN jsonb_build_array()
    ELSE (SELECT jsonb_agg(x.item ORDER BY i) FROM x)
  END
$$;
COMMENT ON COLUMN pgcbor_next_state.remainder IS 'The remainder after decoding a CBOR item';
COMMENT ON COLUMN pgcbor_next_state.item IS 'A single decoded CBOR item';