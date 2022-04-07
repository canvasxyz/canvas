import * as t from "io-ts";
export const actionArgumentType = t.union([t.null, t.boolean, t.number, t.string]);
export const actionPayloadType = t.type({
    from: t.string,
    spec: t.string,
    timestamp: t.number,
    call: t.string,
    args: t.array(actionArgumentType),
});
export const actionType = t.type({
    from: t.string,
    session: t.union([t.string, t.null]),
    chainId: t.string,
    signature: t.string,
    payload: t.string,
});
export const sessionType = t.type({
    from: t.string,
    signature: t.string,
    payload: t.string,
    session_public_key: t.string,
});
export const sessionPayloadType = t.type({
    from: t.string,
    spec: t.string,
    timestamp: t.number,
    metadata: t.string,
    session_public_key: t.string,
});
export const _sessions = {
    session_public_key: "string",
    timestamp: "integer",
    metadata: "string",
    signature: "string",
};
