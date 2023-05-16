import * as $protobuf from "protobufjs";
import Long = require("long");
/** Properties of a DiscoveryRecord. */
export interface IDiscoveryRecord {

    /** DiscoveryRecord addrs */
    addrs?: (Uint8Array[]|null);

    /** DiscoveryRecord topics */
    topics?: (string[]|null);
}

/** Represents a DiscoveryRecord. */
export class DiscoveryRecord implements IDiscoveryRecord {

    /**
     * Constructs a new DiscoveryRecord.
     * @param [properties] Properties to set
     */
    constructor(properties?: IDiscoveryRecord);

    /** DiscoveryRecord addrs. */
    public addrs: Uint8Array[];

    /** DiscoveryRecord topics. */
    public topics: string[];

    /**
     * Creates a new DiscoveryRecord instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DiscoveryRecord instance
     */
    public static create(properties?: IDiscoveryRecord): DiscoveryRecord;

    /**
     * Encodes the specified DiscoveryRecord message. Does not implicitly {@link DiscoveryRecord.verify|verify} messages.
     * @param message DiscoveryRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IDiscoveryRecord, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified DiscoveryRecord message, length delimited. Does not implicitly {@link DiscoveryRecord.verify|verify} messages.
     * @param message DiscoveryRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IDiscoveryRecord, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a DiscoveryRecord message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DiscoveryRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): DiscoveryRecord;

    /**
     * Decodes a DiscoveryRecord message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DiscoveryRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): DiscoveryRecord;

    /**
     * Verifies a DiscoveryRecord message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a DiscoveryRecord message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DiscoveryRecord
     */
    public static fromObject(object: { [k: string]: any }): DiscoveryRecord;

    /**
     * Creates a plain object from a DiscoveryRecord message. Also converts values to other types if specified.
     * @param message DiscoveryRecord
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: DiscoveryRecord, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this DiscoveryRecord to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for DiscoveryRecord
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a SignedDiscoveryRecord. */
export interface ISignedDiscoveryRecord {

    /** SignedDiscoveryRecord from */
    from?: (Uint8Array|null);

    /** SignedDiscoveryRecord data */
    data?: (Uint8Array|null);

    /** SignedDiscoveryRecord seqno */
    seqno?: (Uint8Array|null);

    /** SignedDiscoveryRecord topic */
    topic?: (string|null);

    /** SignedDiscoveryRecord signature */
    signature?: (Uint8Array|null);

    /** SignedDiscoveryRecord key */
    key?: (Uint8Array|null);
}

/** Represents a SignedDiscoveryRecord. */
export class SignedDiscoveryRecord implements ISignedDiscoveryRecord {

    /**
     * Constructs a new SignedDiscoveryRecord.
     * @param [properties] Properties to set
     */
    constructor(properties?: ISignedDiscoveryRecord);

    /** SignedDiscoveryRecord from. */
    public from: Uint8Array;

    /** SignedDiscoveryRecord data. */
    public data: Uint8Array;

    /** SignedDiscoveryRecord seqno. */
    public seqno: Uint8Array;

    /** SignedDiscoveryRecord topic. */
    public topic: string;

    /** SignedDiscoveryRecord signature. */
    public signature: Uint8Array;

    /** SignedDiscoveryRecord key. */
    public key: Uint8Array;

    /**
     * Creates a new SignedDiscoveryRecord instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SignedDiscoveryRecord instance
     */
    public static create(properties?: ISignedDiscoveryRecord): SignedDiscoveryRecord;

    /**
     * Encodes the specified SignedDiscoveryRecord message. Does not implicitly {@link SignedDiscoveryRecord.verify|verify} messages.
     * @param message SignedDiscoveryRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ISignedDiscoveryRecord, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified SignedDiscoveryRecord message, length delimited. Does not implicitly {@link SignedDiscoveryRecord.verify|verify} messages.
     * @param message SignedDiscoveryRecord message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ISignedDiscoveryRecord, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a SignedDiscoveryRecord message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SignedDiscoveryRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): SignedDiscoveryRecord;

    /**
     * Decodes a SignedDiscoveryRecord message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SignedDiscoveryRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): SignedDiscoveryRecord;

    /**
     * Verifies a SignedDiscoveryRecord message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a SignedDiscoveryRecord message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SignedDiscoveryRecord
     */
    public static fromObject(object: { [k: string]: any }): SignedDiscoveryRecord;

    /**
     * Creates a plain object from a SignedDiscoveryRecord message. Also converts values to other types if specified.
     * @param message SignedDiscoveryRecord
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: SignedDiscoveryRecord, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this SignedDiscoveryRecord to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SignedDiscoveryRecord
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a FetchPeersResponse. */
export interface IFetchPeersResponse {

    /** FetchPeersResponse records */
    records?: (ISignedDiscoveryRecord[]|null);
}

/** Represents a FetchPeersResponse. */
export class FetchPeersResponse implements IFetchPeersResponse {

    /**
     * Constructs a new FetchPeersResponse.
     * @param [properties] Properties to set
     */
    constructor(properties?: IFetchPeersResponse);

    /** FetchPeersResponse records. */
    public records: ISignedDiscoveryRecord[];

    /**
     * Creates a new FetchPeersResponse instance using the specified properties.
     * @param [properties] Properties to set
     * @returns FetchPeersResponse instance
     */
    public static create(properties?: IFetchPeersResponse): FetchPeersResponse;

    /**
     * Encodes the specified FetchPeersResponse message. Does not implicitly {@link FetchPeersResponse.verify|verify} messages.
     * @param message FetchPeersResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IFetchPeersResponse, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified FetchPeersResponse message, length delimited. Does not implicitly {@link FetchPeersResponse.verify|verify} messages.
     * @param message FetchPeersResponse message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IFetchPeersResponse, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a FetchPeersResponse message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns FetchPeersResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): FetchPeersResponse;

    /**
     * Decodes a FetchPeersResponse message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns FetchPeersResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): FetchPeersResponse;

    /**
     * Verifies a FetchPeersResponse message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a FetchPeersResponse message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns FetchPeersResponse
     */
    public static fromObject(object: { [k: string]: any }): FetchPeersResponse;

    /**
     * Creates a plain object from a FetchPeersResponse message. Also converts values to other types if specified.
     * @param message FetchPeersResponse
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: FetchPeersResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this FetchPeersResponse to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for FetchPeersResponse
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}
