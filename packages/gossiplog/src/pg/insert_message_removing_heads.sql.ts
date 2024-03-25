export const insertMessageRemovingHeadsSql = String.raw`
DROP PROCEDURE IF EXISTS insert_message_removing_heads(BYTEA, BYTEA, BYTEA, BYTEA, BYTEA[]);

CREATE OR REPLACE PROCEDURE insert_message_removing_heads(key_ BYTEA, value BYTEA, hash BYTEA, cbor_null BYTEA, heads_ BYTEA[]) AS $$
BEGIN
  CALL messages_okra_set(key_, value, hash);
  INSERT INTO heads (key, value) VALUES (key_, cbor_null) ON CONFLICT (key) DO UPDATE SET value = cbor_null;
  DELETE FROM heads WHERE key = ANY(heads_);
END
$$ LANGUAGE plpgsql;`
