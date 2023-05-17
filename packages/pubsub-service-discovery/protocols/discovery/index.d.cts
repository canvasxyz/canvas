import * as $protobuf from "protobufjs";
import Long = require("long");
/** Properties of a Record. */
export interface IRecord {

    /** Record addrs */
    addrs?: (Uint8Array[]|null);

    /** Record protocols */
    protocols?: (string[]|null);
}

/** Represents a Record. */
export class Record implements IRecord {

    /**
     * Constructs a new Record.
     * @param [properties] Properties to set
     */
    constructor(properties?: IRecord);

    /** Record addrs. */
    public addrs: Uint8Array[];

    /** Record protocols. */
    public protocols: string[];

    /**
     * Creates a new Record instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Record instance
     */
    public static create(properties?: IRecord): Record;

    /**
     * Encodes the specified Record message. Does not implicitly {@link Record.verify|verify} messages.
     * @param message Record message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IRecord, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Record message, length delimited. Does not implicitly {@link Record.verify|verify} messages.
     * @param message Record message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IRecord, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Record message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Record
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Record;

    /**
     * Decodes a Record message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Record
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Record;

    /**
     * Verifies a Record message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Record message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Record
     */
    public static fromObject(object: { [k: string]: any }): Record;

    /**
     * Creates a plain object from a Record message. Also converts values to other types if specified.
     * @param message Record
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Record, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Record to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Record
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a SignedRecord. */
export interface ISignedRecord {

    /** SignedRecord from */
    from?: (Uint8Array|null);

    /** SignedRecord data */
    data?: (Uint8Array|null);

    /** SignedRecord seqno */
    seqno?: (Uint8Array|null);

    /** SignedRecord topic */
    topic?: (string|null);

    /** SignedRecord signature */
    signature?: (Uint8Array|null);

    /** SignedRecord key */
    key?: (Uint8Array|null);
}

/** Represents a SignedRecord. */
export class SignedRecord implements ISignedRecord {

    /**
     * Constructs a new SignedRecord.
     * @param [properties] Properties to set
     */
    constructor(properties?: ISignedRecord);

    /** SignedRecord from. */
    public from: Uint8Array;

    /** SignedRecord data. */
    public data: Uint8Array;

    /** SignedRecord seqno. */
    public seqno: Uint8Array;

    /** SignedRecord topic. */
    public topic: string;

    /** SignedRecord signature. */
    public signature: Uint8Array;

    /** SignedRecord key. */
    public key: Uint8Array;

    /**
     * Creates a new SignedRecord instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SignedRecord instance
     */
    public static create(properties?: ISignedRecord): SignedRecord;

    /**
     * Encodes the specified SignedRecord message. Does not implicitly {@link SignedRecord.verify|verify} messages.
     * @param message SignedRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ISignedRecord, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified SignedRecord message, length delimited. Does not implicitly {@link SignedRecord.verify|verify} messages.
     * @param message SignedRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ISignedRecord, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a SignedRecord message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SignedRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): SignedRecord;

    /**
     * Decodes a SignedRecord message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SignedRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): SignedRecord;

    /**
     * Verifies a SignedRecord message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a SignedRecord message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SignedRecord
     */
    public static fromObject(object: { [k: string]: any }): SignedRecord;

    /**
     * Creates a plain object from a SignedRecord message. Also converts values to other types if specified.
     * @param message SignedRecord
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: SignedRecord, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this SignedRecord to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SignedRecord
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a QueryRequest. */
export interface IQueryRequest {

    /** QueryRequest protocol */
    protocol?: (string|null);

    /** QueryRequest limit */
    limit?: (number|null);
}

/** Represents a QueryRequest. */
export class QueryRequest implements IQueryRequest {

    /**
     * Constructs a new QueryRequest.
     * @param [properties] Properties to set
     */
    constructor(properties?: IQueryRequest);

    /** QueryRequest protocol. */
    public protocol: string;

    /** QueryRequest limit. */
    public limit: number;

    /**
     * Creates a new QueryRequest instance using the specified properties.
     * @param [properties] Properties to set
     * @returns QueryRequest instance
     */
    public static create(properties?: IQueryRequest): QueryRequest;

    /**
     * Encodes the specified QueryRequest message. Does not implicitly {@link QueryRequest.verify|verify} messages.
     * @param message QueryRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IQueryRequest, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified QueryRequest message, length delimited. Does not implicitly {@link QueryRequest.verify|verify} messages.
     * @param message QueryRequest message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IQueryRequest, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a QueryRequest message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns QueryRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): QueryRequest;

    /**
     * Decodes a QueryRequest message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns QueryRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): QueryRequest;

    /**
     * Verifies a QueryRequest message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a QueryRequest message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns QueryRequest
     */
    public static fromObject(object: { [k: string]: any }): QueryRequest;

    /**
     * Creates a plain object from a QueryRequest message. Also converts values to other types if specified.
     * @param message QueryRequest
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: QueryRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this QueryRequest to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for QueryRequest
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a QueryResponse. */
export interface IQueryResponse {

    /** QueryResponse records */
    records?: (ISignedRecord[]|null);
}

/** Represents a QueryResponse. */
export class QueryResponse implements IQueryResponse {

    /**
     * Constructs a new QueryResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: IQueryResponse);

    /** QueryResponse records. */
    public records: ISignedRecord[];

    /**
     * Creates a new QueryResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns QueryResponse instance
     */
    public static create(properties?: IQueryResponse): QueryResponse;

    /**
     * Encodes the specified QueryResponse message. Does not implicitly {@link QueryResponse.verify|verify} messages.
     * @param message QueryResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IQueryResponse, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified QueryResponse message, length delimited. Does not implicitly {@link QueryResponse.verify|verify} messages.
     * @param message QueryResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IQueryResponse, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a QueryResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns QueryResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): QueryResponse;

    /**
     * Decodes a QueryResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns QueryResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): QueryResponse;

    /**
     * Verifies a QueryResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a QueryResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns QueryResponse
     */
    public static fromObject(object: { [k: string]: any }): QueryResponse;

    /**
     * Creates a plain object from a QueryResponse message. Also converts values to other types if specified.
     * @param message QueryResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: QueryResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this QueryResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for QueryResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}
