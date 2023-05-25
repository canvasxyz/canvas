import * as $protobuf from "protobufjs";
import Long = require("long");
/** Properties of a SignedData. */
export interface ISignedData {

    /** SignedData signature */
    signature?: (Uint8Array|null);

    /** SignedData payload */
    payload?: (Uint8Array|null);
}

/** Represents a SignedData. */
export class SignedData implements ISignedData {

    /**
     * Constructs a new SignedData.
     * @param [properties] Properties to set
     */
    constructor(properties?: ISignedData);

    /** SignedData signature. */
    public signature: Uint8Array;

    /** SignedData payload. */
    public payload: Uint8Array;

    /**
     * Creates a new SignedData instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SignedData instance
     */
    public static create(properties?: ISignedData): SignedData;

    /**
     * Encodes the specified SignedData message. Does not implicitly {@link SignedData.verify|verify} messages.
     * @param message SignedData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ISignedData, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified SignedData message, length delimited. Does not implicitly {@link SignedData.verify|verify} messages.
     * @param message SignedData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ISignedData, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a SignedData message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SignedData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): SignedData;

    /**
     * Decodes a SignedData message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SignedData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): SignedData;

    /**
     * Verifies a SignedData message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a SignedData message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SignedData
     */
    public static fromObject(object: { [k: string]: any }): SignedData;

    /**
     * Creates a plain object from a SignedData message. Also converts values to other types if specified.
     * @param message SignedData
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: SignedData, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this SignedData to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SignedData
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an EncryptedData. */
export interface IEncryptedData {

    /** EncryptedData publicKey */
    publicKey?: (Uint8Array|null);

    /** EncryptedData ciphertext */
    ciphertext?: (Uint8Array|null);

    /** EncryptedData ephemPublicKey */
    ephemPublicKey?: (Uint8Array|null);

    /** EncryptedData nonce */
    nonce?: (Uint8Array|null);

    /** EncryptedData version */
    version?: (string|null);
}

/** Represents an EncryptedData. */
export class EncryptedData implements IEncryptedData {

    /**
     * Constructs a new EncryptedData.
     * @param [properties] Properties to set
     */
    constructor(properties?: IEncryptedData);

    /** EncryptedData publicKey. */
    public publicKey: Uint8Array;

    /** EncryptedData ciphertext. */
    public ciphertext: Uint8Array;

    /** EncryptedData ephemPublicKey. */
    public ephemPublicKey: Uint8Array;

    /** EncryptedData nonce. */
    public nonce: Uint8Array;

    /** EncryptedData version. */
    public version: string;

    /**
     * Creates a new EncryptedData instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EncryptedData instance
     */
    public static create(properties?: IEncryptedData): EncryptedData;

    /**
     * Encodes the specified EncryptedData message. Does not implicitly {@link EncryptedData.verify|verify} messages.
     * @param message EncryptedData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IEncryptedData, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified EncryptedData message, length delimited. Does not implicitly {@link EncryptedData.verify|verify} messages.
     * @param message EncryptedData message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IEncryptedData, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an EncryptedData message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EncryptedData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): EncryptedData;

    /**
     * Decodes an EncryptedData message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EncryptedData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): EncryptedData;

    /**
     * Verifies an EncryptedData message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an EncryptedData message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EncryptedData
     */
    public static fromObject(object: { [k: string]: any }): EncryptedData;

    /**
     * Creates a plain object from an EncryptedData message. Also converts values to other types if specified.
     * @param message EncryptedData
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: EncryptedData, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this EncryptedData to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EncryptedData
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a SignedUserRegistration. */
export interface ISignedUserRegistration {

    /** SignedUserRegistration signature */
    signature?: (Uint8Array|null);

    /** SignedUserRegistration address */
    address?: (Uint8Array|null);

    /** SignedUserRegistration keyBundle */
    keyBundle?: (SignedUserRegistration.IKeyBundle|null);
}

/** Represents a SignedUserRegistration. */
export class SignedUserRegistration implements ISignedUserRegistration {

    /**
     * Constructs a new SignedUserRegistration.
     * @param [properties] Properties to set
     */
    constructor(properties?: ISignedUserRegistration);

    /** SignedUserRegistration signature. */
    public signature: Uint8Array;

    /** SignedUserRegistration address. */
    public address: Uint8Array;

    /** SignedUserRegistration keyBundle. */
    public keyBundle?: (SignedUserRegistration.IKeyBundle|null);

    /**
     * Creates a new SignedUserRegistration instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SignedUserRegistration instance
     */
    public static create(properties?: ISignedUserRegistration): SignedUserRegistration;

    /**
     * Encodes the specified SignedUserRegistration message. Does not implicitly {@link SignedUserRegistration.verify|verify} messages.
     * @param message SignedUserRegistration message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ISignedUserRegistration, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified SignedUserRegistration message, length delimited. Does not implicitly {@link SignedUserRegistration.verify|verify} messages.
     * @param message SignedUserRegistration message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ISignedUserRegistration, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a SignedUserRegistration message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SignedUserRegistration
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): SignedUserRegistration;

    /**
     * Decodes a SignedUserRegistration message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SignedUserRegistration
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): SignedUserRegistration;

    /**
     * Verifies a SignedUserRegistration message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a SignedUserRegistration message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SignedUserRegistration
     */
    public static fromObject(object: { [k: string]: any }): SignedUserRegistration;

    /**
     * Creates a plain object from a SignedUserRegistration message. Also converts values to other types if specified.
     * @param message SignedUserRegistration
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: SignedUserRegistration, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this SignedUserRegistration to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SignedUserRegistration
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace SignedUserRegistration {

    /** Properties of a KeyBundle. */
    interface IKeyBundle {

        /** KeyBundle signingAddress */
        signingAddress?: (Uint8Array|null);

        /** KeyBundle encryptionPublicKey */
        encryptionPublicKey?: (Uint8Array|null);
    }

    /** Represents a KeyBundle. */
    class KeyBundle implements IKeyBundle {

        /**
         * Constructs a new KeyBundle.
         * @param [properties] Properties to set
         */
        constructor(properties?: SignedUserRegistration.IKeyBundle);

        /** KeyBundle signingAddress. */
        public signingAddress: Uint8Array;

        /** KeyBundle encryptionPublicKey. */
        public encryptionPublicKey: Uint8Array;

        /**
         * Creates a new KeyBundle instance using the specified properties.
         * @param [properties] Properties to set
         * @returns KeyBundle instance
         */
        public static create(properties?: SignedUserRegistration.IKeyBundle): SignedUserRegistration.KeyBundle;

        /**
         * Encodes the specified KeyBundle message. Does not implicitly {@link SignedUserRegistration.KeyBundle.verify|verify} messages.
         * @param message KeyBundle message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: SignedUserRegistration.IKeyBundle, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified KeyBundle message, length delimited. Does not implicitly {@link SignedUserRegistration.KeyBundle.verify|verify} messages.
         * @param message KeyBundle message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: SignedUserRegistration.IKeyBundle, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a KeyBundle message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns KeyBundle
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): SignedUserRegistration.KeyBundle;

        /**
         * Decodes a KeyBundle message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns KeyBundle
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): SignedUserRegistration.KeyBundle;

        /**
         * Verifies a KeyBundle message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a KeyBundle message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns KeyBundle
         */
        public static fromObject(object: { [k: string]: any }): SignedUserRegistration.KeyBundle;

        /**
         * Creates a plain object from a KeyBundle message. Also converts values to other types if specified.
         * @param message KeyBundle
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: SignedUserRegistration.KeyBundle, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this KeyBundle to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for KeyBundle
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}

/** Properties of a RoomRegistration. */
export interface IRoomRegistration {

    /** RoomRegistration creator */
    creator?: (Uint8Array|null);

    /** RoomRegistration members */
    members?: (ISignedUserRegistration[]|null);
}

/** Represents a RoomRegistration. */
export class RoomRegistration implements IRoomRegistration {

    /**
     * Constructs a new RoomRegistration.
     * @param [properties] Properties to set
     */
    constructor(properties?: IRoomRegistration);

    /** RoomRegistration creator. */
    public creator: Uint8Array;

    /** RoomRegistration members. */
    public members: ISignedUserRegistration[];

    /**
     * Creates a new RoomRegistration instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RoomRegistration instance
     */
    public static create(properties?: IRoomRegistration): RoomRegistration;

    /**
     * Encodes the specified RoomRegistration message. Does not implicitly {@link RoomRegistration.verify|verify} messages.
     * @param message RoomRegistration message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IRoomRegistration, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified RoomRegistration message, length delimited. Does not implicitly {@link RoomRegistration.verify|verify} messages.
     * @param message RoomRegistration message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IRoomRegistration, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a RoomRegistration message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RoomRegistration
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): RoomRegistration;

    /**
     * Decodes a RoomRegistration message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RoomRegistration
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): RoomRegistration;

    /**
     * Verifies a RoomRegistration message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a RoomRegistration message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RoomRegistration
     */
    public static fromObject(object: { [k: string]: any }): RoomRegistration;

    /**
     * Creates a plain object from a RoomRegistration message. Also converts values to other types if specified.
     * @param message RoomRegistration
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: RoomRegistration, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this RoomRegistration to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RoomRegistration
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}
