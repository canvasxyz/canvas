import * as $protobuf from "protobufjs";
import Long = require("long");
/** Properties of a SignedEvent. */
export interface ISignedEvent {

    /** SignedEvent signature */
    signature?: (Uint8Array|null);

    /** SignedEvent payload */
    payload?: (Uint8Array|null);
}

/** Represents a SignedEvent. */
export class SignedEvent implements ISignedEvent {

    /**
     * Constructs a new SignedEvent.
     * @param [properties] Properties to set
     */
    constructor(properties?: ISignedEvent);

    /** SignedEvent signature. */
    public signature: Uint8Array;

    /** SignedEvent payload. */
    public payload: Uint8Array;

    /**
     * Creates a new SignedEvent instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SignedEvent instance
     */
    public static create(properties?: ISignedEvent): SignedEvent;

    /**
     * Encodes the specified SignedEvent message. Does not implicitly {@link SignedEvent.verify|verify} messages.
     * @param message SignedEvent message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ISignedEvent, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified SignedEvent message, length delimited. Does not implicitly {@link SignedEvent.verify|verify} messages.
     * @param message SignedEvent message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ISignedEvent, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a SignedEvent message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SignedEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): SignedEvent;

    /**
     * Decodes a SignedEvent message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SignedEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): SignedEvent;

    /**
     * Verifies a SignedEvent message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a SignedEvent message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SignedEvent
     */
    public static fromObject(object: { [k: string]: any }): SignedEvent;

    /**
     * Creates a plain object from a SignedEvent message. Also converts values to other types if specified.
     * @param message SignedEvent
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: SignedEvent, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this SignedEvent to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SignedEvent
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an EncryptedEvent. */
export interface IEncryptedEvent {

    /** EncryptedEvent publicKey */
    publicKey?: (Uint8Array|null);

    /** EncryptedEvent ciphertext */
    ciphertext?: (Uint8Array|null);

    /** EncryptedEvent ephemPublicKey */
    ephemPublicKey?: (Uint8Array|null);

    /** EncryptedEvent nonce */
    nonce?: (Uint8Array|null);

    /** EncryptedEvent version */
    version?: (string|null);
}

/** Represents an EncryptedEvent. */
export class EncryptedEvent implements IEncryptedEvent {

    /**
     * Constructs a new EncryptedEvent.
     * @param [properties] Properties to set
     */
    constructor(properties?: IEncryptedEvent);

    /** EncryptedEvent publicKey. */
    public publicKey: Uint8Array;

    /** EncryptedEvent ciphertext. */
    public ciphertext: Uint8Array;

    /** EncryptedEvent ephemPublicKey. */
    public ephemPublicKey: Uint8Array;

    /** EncryptedEvent nonce. */
    public nonce: Uint8Array;

    /** EncryptedEvent version. */
    public version: string;

    /**
     * Creates a new EncryptedEvent instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EncryptedEvent instance
     */
    public static create(properties?: IEncryptedEvent): EncryptedEvent;

    /**
     * Encodes the specified EncryptedEvent message. Does not implicitly {@link EncryptedEvent.verify|verify} messages.
     * @param message EncryptedEvent message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IEncryptedEvent, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified EncryptedEvent message, length delimited. Does not implicitly {@link EncryptedEvent.verify|verify} messages.
     * @param message EncryptedEvent message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IEncryptedEvent, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an EncryptedEvent message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EncryptedEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): EncryptedEvent;

    /**
     * Decodes an EncryptedEvent message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EncryptedEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): EncryptedEvent;

    /**
     * Verifies an EncryptedEvent message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an EncryptedEvent message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EncryptedEvent
     */
    public static fromObject(object: { [k: string]: any }): EncryptedEvent;

    /**
     * Creates a plain object from an EncryptedEvent message. Also converts values to other types if specified.
     * @param message EncryptedEvent
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: EncryptedEvent, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this EncryptedEvent to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EncryptedEvent
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a SignedKeyBundle. */
export interface ISignedKeyBundle {

    /** SignedKeyBundle signature */
    signature?: (Uint8Array|null);

    /** SignedKeyBundle signingAddress */
    signingAddress?: (Uint8Array|null);

    /** SignedKeyBundle encryptionPublicKey */
    encryptionPublicKey?: (Uint8Array|null);
}

/** Represents a SignedKeyBundle. */
export class SignedKeyBundle implements ISignedKeyBundle {

    /**
     * Constructs a new SignedKeyBundle.
     * @param [properties] Properties to set
     */
    constructor(properties?: ISignedKeyBundle);

    /** SignedKeyBundle signature. */
    public signature: Uint8Array;

    /** SignedKeyBundle signingAddress. */
    public signingAddress: Uint8Array;

    /** SignedKeyBundle encryptionPublicKey. */
    public encryptionPublicKey: Uint8Array;

    /**
     * Creates a new SignedKeyBundle instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SignedKeyBundle instance
     */
    public static create(properties?: ISignedKeyBundle): SignedKeyBundle;

    /**
     * Encodes the specified SignedKeyBundle message. Does not implicitly {@link SignedKeyBundle.verify|verify} messages.
     * @param message SignedKeyBundle message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ISignedKeyBundle, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified SignedKeyBundle message, length delimited. Does not implicitly {@link SignedKeyBundle.verify|verify} messages.
     * @param message SignedKeyBundle message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ISignedKeyBundle, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a SignedKeyBundle message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SignedKeyBundle
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): SignedKeyBundle;

    /**
     * Decodes a SignedKeyBundle message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SignedKeyBundle
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): SignedKeyBundle;

    /**
     * Verifies a SignedKeyBundle message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a SignedKeyBundle message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SignedKeyBundle
     */
    public static fromObject(object: { [k: string]: any }): SignedKeyBundle;

    /**
     * Creates a plain object from a SignedKeyBundle message. Also converts values to other types if specified.
     * @param message SignedKeyBundle
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: SignedKeyBundle, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this SignedKeyBundle to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SignedKeyBundle
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a Room. */
export interface IRoom {

    /** Room topic */
    topic?: (string|null);

    /** Room creator */
    creator?: (string|null);

    /** Room members */
    members?: (string[]|null);
}

/** Represents a Room. */
export class Room implements IRoom {

    /**
     * Constructs a new Room.
     * @param [properties] Properties to set
     */
    constructor(properties?: IRoom);

    /** Room topic. */
    public topic: string;

    /** Room creator. */
    public creator: string;

    /** Room members. */
    public members: string[];

    /**
     * Creates a new Room instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Room instance
     */
    public static create(properties?: IRoom): Room;

    /**
     * Encodes the specified Room message. Does not implicitly {@link Room.verify|verify} messages.
     * @param message Room message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IRoom, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Room message, length delimited. Does not implicitly {@link Room.verify|verify} messages.
     * @param message Room message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IRoom, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Room message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Room
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Room;

    /**
     * Decodes a Room message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Room
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Room;

    /**
     * Verifies a Room message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Room message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Room
     */
    public static fromObject(object: { [k: string]: any }): Room;

    /**
     * Creates a plain object from a Room message. Also converts values to other types if specified.
     * @param message Room
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Room, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Room to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Room
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}
