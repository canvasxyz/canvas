import * as $protobuf from "protobufjs";
import Long = require("long");
/** Properties of a Node. */
export interface INode {

    /** Node level */
    level?: (number|null);

    /** Node key */
    key?: (Uint8Array|null);

    /** Node hash */
    hash?: (Uint8Array|null);

    /** Node value */
    value?: (Uint8Array|null);
}

/** Represents a Node. */
export class Node implements INode {

    /**
     * Constructs a new Node.
     * @param [properties] Properties to set
     */
    constructor(properties?: INode);

    /** Node level. */
    public level: number;

    /** Node key. */
    public key: Uint8Array;

    /** Node hash. */
    public hash: Uint8Array;

    /** Node value. */
    public value?: (Uint8Array|null);

    /** Node _value. */
    public _value?: "value";

    /**
     * Creates a new Node instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Node instance
     */
    public static create(properties?: INode): Node;

    /**
     * Encodes the specified Node message. Does not implicitly {@link Node.verify|verify} messages.
     * @param message Node message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: INode, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Node message, length delimited. Does not implicitly {@link Node.verify|verify} messages.
     * @param message Node message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: INode, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Node message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Node
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Node;

    /**
     * Decodes a Node message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Node
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Node;

    /**
     * Verifies a Node message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Node message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Node
     */
    public static fromObject(object: { [k: string]: any }): Node;

    /**
     * Creates a plain object from a Node message. Also converts values to other types if specified.
     * @param message Node
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Node, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Node to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Node
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a Request. */
export interface IRequest {

    /** Request seq */
    seq?: (number|null);

    /** Request getRoot */
    getRoot?: (Request.IGetRootRequest|null);

    /** Request getChildren */
    getChildren?: (Request.IGetChildrenRequest|null);

    /** Request getMessages */
    getMessages?: (Request.IGetMessagesRequest|null);
}

/** Represents a Request. */
export class Request implements IRequest {

    /**
     * Constructs a new Request.
     * @param [properties] Properties to set
     */
    constructor(properties?: IRequest);

    /** Request seq. */
    public seq: number;

    /** Request getRoot. */
    public getRoot?: (Request.IGetRootRequest|null);

    /** Request getChildren. */
    public getChildren?: (Request.IGetChildrenRequest|null);

    /** Request getMessages. */
    public getMessages?: (Request.IGetMessagesRequest|null);

    /** Request request. */
    public request?: ("getRoot"|"getChildren"|"getMessages");

    /**
     * Creates a new Request instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Request instance
     */
    public static create(properties?: IRequest): Request;

    /**
     * Encodes the specified Request message. Does not implicitly {@link Request.verify|verify} messages.
     * @param message Request message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IRequest, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Request message, length delimited. Does not implicitly {@link Request.verify|verify} messages.
     * @param message Request message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IRequest, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Request message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Request
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Request;

    /**
     * Decodes a Request message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Request
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Request;

    /**
     * Verifies a Request message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Request message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Request
     */
    public static fromObject(object: { [k: string]: any }): Request;

    /**
     * Creates a plain object from a Request message. Also converts values to other types if specified.
     * @param message Request
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Request, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Request to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Request
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace Request {

    /** Properties of a GetRootRequest. */
    interface IGetRootRequest {
    }

    /** Represents a GetRootRequest. */
    class GetRootRequest implements IGetRootRequest {

        /**
         * Constructs a new GetRootRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: Request.IGetRootRequest);

        /**
         * Creates a new GetRootRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GetRootRequest instance
         */
        public static create(properties?: Request.IGetRootRequest): Request.GetRootRequest;

        /**
         * Encodes the specified GetRootRequest message. Does not implicitly {@link Request.GetRootRequest.verify|verify} messages.
         * @param message GetRootRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: Request.IGetRootRequest, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GetRootRequest message, length delimited. Does not implicitly {@link Request.GetRootRequest.verify|verify} messages.
         * @param message GetRootRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: Request.IGetRootRequest, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GetRootRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GetRootRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Request.GetRootRequest;

        /**
         * Decodes a GetRootRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GetRootRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Request.GetRootRequest;

        /**
         * Verifies a GetRootRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a GetRootRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GetRootRequest
         */
        public static fromObject(object: { [k: string]: any }): Request.GetRootRequest;

        /**
         * Creates a plain object from a GetRootRequest message. Also converts values to other types if specified.
         * @param message GetRootRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: Request.GetRootRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this GetRootRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GetRootRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GetChildrenRequest. */
    interface IGetChildrenRequest {

        /** GetChildrenRequest level */
        level?: (number|null);

        /** GetChildrenRequest key */
        key?: (Uint8Array|null);
    }

    /** Represents a GetChildrenRequest. */
    class GetChildrenRequest implements IGetChildrenRequest {

        /**
         * Constructs a new GetChildrenRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: Request.IGetChildrenRequest);

        /** GetChildrenRequest level. */
        public level: number;

        /** GetChildrenRequest key. */
        public key: Uint8Array;

        /**
         * Creates a new GetChildrenRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GetChildrenRequest instance
         */
        public static create(properties?: Request.IGetChildrenRequest): Request.GetChildrenRequest;

        /**
         * Encodes the specified GetChildrenRequest message. Does not implicitly {@link Request.GetChildrenRequest.verify|verify} messages.
         * @param message GetChildrenRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: Request.IGetChildrenRequest, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GetChildrenRequest message, length delimited. Does not implicitly {@link Request.GetChildrenRequest.verify|verify} messages.
         * @param message GetChildrenRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: Request.IGetChildrenRequest, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GetChildrenRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GetChildrenRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Request.GetChildrenRequest;

        /**
         * Decodes a GetChildrenRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GetChildrenRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Request.GetChildrenRequest;

        /**
         * Verifies a GetChildrenRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a GetChildrenRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GetChildrenRequest
         */
        public static fromObject(object: { [k: string]: any }): Request.GetChildrenRequest;

        /**
         * Creates a plain object from a GetChildrenRequest message. Also converts values to other types if specified.
         * @param message GetChildrenRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: Request.GetChildrenRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this GetChildrenRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GetChildrenRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GetMessagesRequest. */
    interface IGetMessagesRequest {

        /** GetMessagesRequest ids */
        ids?: (Uint8Array[]|null);
    }

    /** Represents a GetMessagesRequest. */
    class GetMessagesRequest implements IGetMessagesRequest {

        /**
         * Constructs a new GetMessagesRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: Request.IGetMessagesRequest);

        /** GetMessagesRequest ids. */
        public ids: Uint8Array[];

        /**
         * Creates a new GetMessagesRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GetMessagesRequest instance
         */
        public static create(properties?: Request.IGetMessagesRequest): Request.GetMessagesRequest;

        /**
         * Encodes the specified GetMessagesRequest message. Does not implicitly {@link Request.GetMessagesRequest.verify|verify} messages.
         * @param message GetMessagesRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: Request.IGetMessagesRequest, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GetMessagesRequest message, length delimited. Does not implicitly {@link Request.GetMessagesRequest.verify|verify} messages.
         * @param message GetMessagesRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: Request.IGetMessagesRequest, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GetMessagesRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GetMessagesRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Request.GetMessagesRequest;

        /**
         * Decodes a GetMessagesRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GetMessagesRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Request.GetMessagesRequest;

        /**
         * Verifies a GetMessagesRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a GetMessagesRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GetMessagesRequest
         */
        public static fromObject(object: { [k: string]: any }): Request.GetMessagesRequest;

        /**
         * Creates a plain object from a GetMessagesRequest message. Also converts values to other types if specified.
         * @param message GetMessagesRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: Request.GetMessagesRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this GetMessagesRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GetMessagesRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}

/** Properties of a Response. */
export interface IResponse {

    /** Response seq */
    seq?: (number|null);

    /** Response getRoot */
    getRoot?: (Response.IGetRootResponse|null);

    /** Response getChildren */
    getChildren?: (Response.IGetChildrenResponse|null);

    /** Response getMessages */
    getMessages?: (Response.IGetMessagesResponse|null);
}

/** Represents a Response. */
export class Response implements IResponse {

    /**
     * Constructs a new Response.
     * @param [properties] Properties to set
     */
    constructor(properties?: IResponse);

    /** Response seq. */
    public seq: number;

    /** Response getRoot. */
    public getRoot?: (Response.IGetRootResponse|null);

    /** Response getChildren. */
    public getChildren?: (Response.IGetChildrenResponse|null);

    /** Response getMessages. */
    public getMessages?: (Response.IGetMessagesResponse|null);

    /** Response response. */
    public response?: ("getRoot"|"getChildren"|"getMessages");

    /**
     * Creates a new Response instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Response instance
     */
    public static create(properties?: IResponse): Response;

    /**
     * Encodes the specified Response message. Does not implicitly {@link Response.verify|verify} messages.
     * @param message Response message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IResponse, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Response message, length delimited. Does not implicitly {@link Response.verify|verify} messages.
     * @param message Response message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IResponse, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Response message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Response
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Response;

    /**
     * Decodes a Response message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Response
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Response;

    /**
     * Verifies a Response message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Response message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Response
     */
    public static fromObject(object: { [k: string]: any }): Response;

    /**
     * Creates a plain object from a Response message. Also converts values to other types if specified.
     * @param message Response
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Response, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Response to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Response
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace Response {

    /** Properties of a GetRootResponse. */
    interface IGetRootResponse {

        /** GetRootResponse root */
        root?: (INode|null);
    }

    /** Represents a GetRootResponse. */
    class GetRootResponse implements IGetRootResponse {

        /**
         * Constructs a new GetRootResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: Response.IGetRootResponse);

        /** GetRootResponse root. */
        public root?: (INode|null);

        /**
         * Creates a new GetRootResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GetRootResponse instance
         */
        public static create(properties?: Response.IGetRootResponse): Response.GetRootResponse;

        /**
         * Encodes the specified GetRootResponse message. Does not implicitly {@link Response.GetRootResponse.verify|verify} messages.
         * @param message GetRootResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: Response.IGetRootResponse, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GetRootResponse message, length delimited. Does not implicitly {@link Response.GetRootResponse.verify|verify} messages.
         * @param message GetRootResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: Response.IGetRootResponse, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GetRootResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GetRootResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Response.GetRootResponse;

        /**
         * Decodes a GetRootResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GetRootResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Response.GetRootResponse;

        /**
         * Verifies a GetRootResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a GetRootResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GetRootResponse
         */
        public static fromObject(object: { [k: string]: any }): Response.GetRootResponse;

        /**
         * Creates a plain object from a GetRootResponse message. Also converts values to other types if specified.
         * @param message GetRootResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: Response.GetRootResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this GetRootResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GetRootResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GetChildrenResponse. */
    interface IGetChildrenResponse {

        /** GetChildrenResponse nodes */
        nodes?: (INode[]|null);
    }

    /** Represents a GetChildrenResponse. */
    class GetChildrenResponse implements IGetChildrenResponse {

        /**
         * Constructs a new GetChildrenResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: Response.IGetChildrenResponse);

        /** GetChildrenResponse nodes. */
        public nodes: INode[];

        /**
         * Creates a new GetChildrenResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GetChildrenResponse instance
         */
        public static create(properties?: Response.IGetChildrenResponse): Response.GetChildrenResponse;

        /**
         * Encodes the specified GetChildrenResponse message. Does not implicitly {@link Response.GetChildrenResponse.verify|verify} messages.
         * @param message GetChildrenResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: Response.IGetChildrenResponse, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GetChildrenResponse message, length delimited. Does not implicitly {@link Response.GetChildrenResponse.verify|verify} messages.
         * @param message GetChildrenResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: Response.IGetChildrenResponse, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GetChildrenResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GetChildrenResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Response.GetChildrenResponse;

        /**
         * Decodes a GetChildrenResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GetChildrenResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Response.GetChildrenResponse;

        /**
         * Verifies a GetChildrenResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a GetChildrenResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GetChildrenResponse
         */
        public static fromObject(object: { [k: string]: any }): Response.GetChildrenResponse;

        /**
         * Creates a plain object from a GetChildrenResponse message. Also converts values to other types if specified.
         * @param message GetChildrenResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: Response.GetChildrenResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this GetChildrenResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GetChildrenResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GetMessagesResponse. */
    interface IGetMessagesResponse {

        /** GetMessagesResponse messages */
        messages?: (Uint8Array[]|null);
    }

    /** Represents a GetMessagesResponse. */
    class GetMessagesResponse implements IGetMessagesResponse {

        /**
         * Constructs a new GetMessagesResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: Response.IGetMessagesResponse);

        /** GetMessagesResponse messages. */
        public messages: Uint8Array[];

        /**
         * Creates a new GetMessagesResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GetMessagesResponse instance
         */
        public static create(properties?: Response.IGetMessagesResponse): Response.GetMessagesResponse;

        /**
         * Encodes the specified GetMessagesResponse message. Does not implicitly {@link Response.GetMessagesResponse.verify|verify} messages.
         * @param message GetMessagesResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: Response.IGetMessagesResponse, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GetMessagesResponse message, length delimited. Does not implicitly {@link Response.GetMessagesResponse.verify|verify} messages.
         * @param message GetMessagesResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: Response.IGetMessagesResponse, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GetMessagesResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GetMessagesResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Response.GetMessagesResponse;

        /**
         * Decodes a GetMessagesResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GetMessagesResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Response.GetMessagesResponse;

        /**
         * Verifies a GetMessagesResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a GetMessagesResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GetMessagesResponse
         */
        public static fromObject(object: { [k: string]: any }): Response.GetMessagesResponse;

        /**
         * Creates a plain object from a GetMessagesResponse message. Also converts values to other types if specified.
         * @param message GetMessagesResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: Response.GetMessagesResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this GetMessagesResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GetMessagesResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}
