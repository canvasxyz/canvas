/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const SignedData = $root.SignedData = (() => {

    /**
     * Properties of a SignedData.
     * @exports ISignedData
     * @interface ISignedData
     * @property {Uint8Array|null} [signature] SignedData signature
     * @property {Uint8Array|null} [payload] SignedData payload
     */

    /**
     * Constructs a new SignedData.
     * @exports SignedData
     * @classdesc Represents a SignedData.
     * @implements ISignedData
     * @constructor
     * @param {ISignedData=} [properties] Properties to set
     */
    function SignedData(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * SignedData signature.
     * @member {Uint8Array} signature
     * @memberof SignedData
     * @instance
     */
    SignedData.prototype.signature = $util.newBuffer([]);

    /**
     * SignedData payload.
     * @member {Uint8Array} payload
     * @memberof SignedData
     * @instance
     */
    SignedData.prototype.payload = $util.newBuffer([]);

    /**
     * Creates a new SignedData instance using the specified properties.
     * @function create
     * @memberof SignedData
     * @static
     * @param {ISignedData=} [properties] Properties to set
     * @returns {SignedData} SignedData instance
     */
    SignedData.create = function create(properties) {
        return new SignedData(properties);
    };

    /**
     * Encodes the specified SignedData message. Does not implicitly {@link SignedData.verify|verify} messages.
     * @function encode
     * @memberof SignedData
     * @static
     * @param {ISignedData} message SignedData message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SignedData.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.signature != null && Object.hasOwnProperty.call(message, "signature"))
            writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.signature);
        if (message.payload != null && Object.hasOwnProperty.call(message, "payload"))
            writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.payload);
        return writer;
    };

    /**
     * Encodes the specified SignedData message, length delimited. Does not implicitly {@link SignedData.verify|verify} messages.
     * @function encodeDelimited
     * @memberof SignedData
     * @static
     * @param {ISignedData} message SignedData message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SignedData.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SignedData message from the specified reader or buffer.
     * @function decode
     * @memberof SignedData
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {SignedData} SignedData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SignedData.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.SignedData();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.signature = reader.bytes();
                    break;
                }
            case 2: {
                    message.payload = reader.bytes();
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a SignedData message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof SignedData
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {SignedData} SignedData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SignedData.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SignedData message.
     * @function verify
     * @memberof SignedData
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SignedData.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.signature != null && message.hasOwnProperty("signature"))
            if (!(message.signature && typeof message.signature.length === "number" || $util.isString(message.signature)))
                return "signature: buffer expected";
        if (message.payload != null && message.hasOwnProperty("payload"))
            if (!(message.payload && typeof message.payload.length === "number" || $util.isString(message.payload)))
                return "payload: buffer expected";
        return null;
    };

    /**
     * Creates a SignedData message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof SignedData
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {SignedData} SignedData
     */
    SignedData.fromObject = function fromObject(object) {
        if (object instanceof $root.SignedData)
            return object;
        let message = new $root.SignedData();
        if (object.signature != null)
            if (typeof object.signature === "string")
                $util.base64.decode(object.signature, message.signature = $util.newBuffer($util.base64.length(object.signature)), 0);
            else if (object.signature.length >= 0)
                message.signature = object.signature;
        if (object.payload != null)
            if (typeof object.payload === "string")
                $util.base64.decode(object.payload, message.payload = $util.newBuffer($util.base64.length(object.payload)), 0);
            else if (object.payload.length >= 0)
                message.payload = object.payload;
        return message;
    };

    /**
     * Creates a plain object from a SignedData message. Also converts values to other types if specified.
     * @function toObject
     * @memberof SignedData
     * @static
     * @param {SignedData} message SignedData
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SignedData.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            if (options.bytes === String)
                object.signature = "";
            else {
                object.signature = [];
                if (options.bytes !== Array)
                    object.signature = $util.newBuffer(object.signature);
            }
            if (options.bytes === String)
                object.payload = "";
            else {
                object.payload = [];
                if (options.bytes !== Array)
                    object.payload = $util.newBuffer(object.payload);
            }
        }
        if (message.signature != null && message.hasOwnProperty("signature"))
            object.signature = options.bytes === String ? $util.base64.encode(message.signature, 0, message.signature.length) : options.bytes === Array ? Array.prototype.slice.call(message.signature) : message.signature;
        if (message.payload != null && message.hasOwnProperty("payload"))
            object.payload = options.bytes === String ? $util.base64.encode(message.payload, 0, message.payload.length) : options.bytes === Array ? Array.prototype.slice.call(message.payload) : message.payload;
        return object;
    };

    /**
     * Converts this SignedData to JSON.
     * @function toJSON
     * @memberof SignedData
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SignedData.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SignedData
     * @function getTypeUrl
     * @memberof SignedData
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SignedData.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/SignedData";
    };

    return SignedData;
})();

export const EncryptedData = $root.EncryptedData = (() => {

    /**
     * Properties of an EncryptedData.
     * @exports IEncryptedData
     * @interface IEncryptedData
     * @property {Uint8Array|null} [publicKey] EncryptedData publicKey
     * @property {Uint8Array|null} [ciphertext] EncryptedData ciphertext
     * @property {Uint8Array|null} [ephemPublicKey] EncryptedData ephemPublicKey
     * @property {Uint8Array|null} [nonce] EncryptedData nonce
     * @property {string|null} [version] EncryptedData version
     */

    /**
     * Constructs a new EncryptedData.
     * @exports EncryptedData
     * @classdesc Represents an EncryptedData.
     * @implements IEncryptedData
     * @constructor
     * @param {IEncryptedData=} [properties] Properties to set
     */
    function EncryptedData(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * EncryptedData publicKey.
     * @member {Uint8Array} publicKey
     * @memberof EncryptedData
     * @instance
     */
    EncryptedData.prototype.publicKey = $util.newBuffer([]);

    /**
     * EncryptedData ciphertext.
     * @member {Uint8Array} ciphertext
     * @memberof EncryptedData
     * @instance
     */
    EncryptedData.prototype.ciphertext = $util.newBuffer([]);

    /**
     * EncryptedData ephemPublicKey.
     * @member {Uint8Array} ephemPublicKey
     * @memberof EncryptedData
     * @instance
     */
    EncryptedData.prototype.ephemPublicKey = $util.newBuffer([]);

    /**
     * EncryptedData nonce.
     * @member {Uint8Array} nonce
     * @memberof EncryptedData
     * @instance
     */
    EncryptedData.prototype.nonce = $util.newBuffer([]);

    /**
     * EncryptedData version.
     * @member {string} version
     * @memberof EncryptedData
     * @instance
     */
    EncryptedData.prototype.version = "";

    /**
     * Creates a new EncryptedData instance using the specified properties.
     * @function create
     * @memberof EncryptedData
     * @static
     * @param {IEncryptedData=} [properties] Properties to set
     * @returns {EncryptedData} EncryptedData instance
     */
    EncryptedData.create = function create(properties) {
        return new EncryptedData(properties);
    };

    /**
     * Encodes the specified EncryptedData message. Does not implicitly {@link EncryptedData.verify|verify} messages.
     * @function encode
     * @memberof EncryptedData
     * @static
     * @param {IEncryptedData} message EncryptedData message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    EncryptedData.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.publicKey != null && Object.hasOwnProperty.call(message, "publicKey"))
            writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.publicKey);
        if (message.ciphertext != null && Object.hasOwnProperty.call(message, "ciphertext"))
            writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.ciphertext);
        if (message.ephemPublicKey != null && Object.hasOwnProperty.call(message, "ephemPublicKey"))
            writer.uint32(/* id 3, wireType 2 =*/26).bytes(message.ephemPublicKey);
        if (message.nonce != null && Object.hasOwnProperty.call(message, "nonce"))
            writer.uint32(/* id 4, wireType 2 =*/34).bytes(message.nonce);
        if (message.version != null && Object.hasOwnProperty.call(message, "version"))
            writer.uint32(/* id 5, wireType 2 =*/42).string(message.version);
        return writer;
    };

    /**
     * Encodes the specified EncryptedData message, length delimited. Does not implicitly {@link EncryptedData.verify|verify} messages.
     * @function encodeDelimited
     * @memberof EncryptedData
     * @static
     * @param {IEncryptedData} message EncryptedData message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    EncryptedData.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an EncryptedData message from the specified reader or buffer.
     * @function decode
     * @memberof EncryptedData
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {EncryptedData} EncryptedData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    EncryptedData.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.EncryptedData();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.publicKey = reader.bytes();
                    break;
                }
            case 2: {
                    message.ciphertext = reader.bytes();
                    break;
                }
            case 3: {
                    message.ephemPublicKey = reader.bytes();
                    break;
                }
            case 4: {
                    message.nonce = reader.bytes();
                    break;
                }
            case 5: {
                    message.version = reader.string();
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes an EncryptedData message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof EncryptedData
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {EncryptedData} EncryptedData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    EncryptedData.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an EncryptedData message.
     * @function verify
     * @memberof EncryptedData
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    EncryptedData.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.publicKey != null && message.hasOwnProperty("publicKey"))
            if (!(message.publicKey && typeof message.publicKey.length === "number" || $util.isString(message.publicKey)))
                return "publicKey: buffer expected";
        if (message.ciphertext != null && message.hasOwnProperty("ciphertext"))
            if (!(message.ciphertext && typeof message.ciphertext.length === "number" || $util.isString(message.ciphertext)))
                return "ciphertext: buffer expected";
        if (message.ephemPublicKey != null && message.hasOwnProperty("ephemPublicKey"))
            if (!(message.ephemPublicKey && typeof message.ephemPublicKey.length === "number" || $util.isString(message.ephemPublicKey)))
                return "ephemPublicKey: buffer expected";
        if (message.nonce != null && message.hasOwnProperty("nonce"))
            if (!(message.nonce && typeof message.nonce.length === "number" || $util.isString(message.nonce)))
                return "nonce: buffer expected";
        if (message.version != null && message.hasOwnProperty("version"))
            if (!$util.isString(message.version))
                return "version: string expected";
        return null;
    };

    /**
     * Creates an EncryptedData message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof EncryptedData
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {EncryptedData} EncryptedData
     */
    EncryptedData.fromObject = function fromObject(object) {
        if (object instanceof $root.EncryptedData)
            return object;
        let message = new $root.EncryptedData();
        if (object.publicKey != null)
            if (typeof object.publicKey === "string")
                $util.base64.decode(object.publicKey, message.publicKey = $util.newBuffer($util.base64.length(object.publicKey)), 0);
            else if (object.publicKey.length >= 0)
                message.publicKey = object.publicKey;
        if (object.ciphertext != null)
            if (typeof object.ciphertext === "string")
                $util.base64.decode(object.ciphertext, message.ciphertext = $util.newBuffer($util.base64.length(object.ciphertext)), 0);
            else if (object.ciphertext.length >= 0)
                message.ciphertext = object.ciphertext;
        if (object.ephemPublicKey != null)
            if (typeof object.ephemPublicKey === "string")
                $util.base64.decode(object.ephemPublicKey, message.ephemPublicKey = $util.newBuffer($util.base64.length(object.ephemPublicKey)), 0);
            else if (object.ephemPublicKey.length >= 0)
                message.ephemPublicKey = object.ephemPublicKey;
        if (object.nonce != null)
            if (typeof object.nonce === "string")
                $util.base64.decode(object.nonce, message.nonce = $util.newBuffer($util.base64.length(object.nonce)), 0);
            else if (object.nonce.length >= 0)
                message.nonce = object.nonce;
        if (object.version != null)
            message.version = String(object.version);
        return message;
    };

    /**
     * Creates a plain object from an EncryptedData message. Also converts values to other types if specified.
     * @function toObject
     * @memberof EncryptedData
     * @static
     * @param {EncryptedData} message EncryptedData
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    EncryptedData.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            if (options.bytes === String)
                object.publicKey = "";
            else {
                object.publicKey = [];
                if (options.bytes !== Array)
                    object.publicKey = $util.newBuffer(object.publicKey);
            }
            if (options.bytes === String)
                object.ciphertext = "";
            else {
                object.ciphertext = [];
                if (options.bytes !== Array)
                    object.ciphertext = $util.newBuffer(object.ciphertext);
            }
            if (options.bytes === String)
                object.ephemPublicKey = "";
            else {
                object.ephemPublicKey = [];
                if (options.bytes !== Array)
                    object.ephemPublicKey = $util.newBuffer(object.ephemPublicKey);
            }
            if (options.bytes === String)
                object.nonce = "";
            else {
                object.nonce = [];
                if (options.bytes !== Array)
                    object.nonce = $util.newBuffer(object.nonce);
            }
            object.version = "";
        }
        if (message.publicKey != null && message.hasOwnProperty("publicKey"))
            object.publicKey = options.bytes === String ? $util.base64.encode(message.publicKey, 0, message.publicKey.length) : options.bytes === Array ? Array.prototype.slice.call(message.publicKey) : message.publicKey;
        if (message.ciphertext != null && message.hasOwnProperty("ciphertext"))
            object.ciphertext = options.bytes === String ? $util.base64.encode(message.ciphertext, 0, message.ciphertext.length) : options.bytes === Array ? Array.prototype.slice.call(message.ciphertext) : message.ciphertext;
        if (message.ephemPublicKey != null && message.hasOwnProperty("ephemPublicKey"))
            object.ephemPublicKey = options.bytes === String ? $util.base64.encode(message.ephemPublicKey, 0, message.ephemPublicKey.length) : options.bytes === Array ? Array.prototype.slice.call(message.ephemPublicKey) : message.ephemPublicKey;
        if (message.nonce != null && message.hasOwnProperty("nonce"))
            object.nonce = options.bytes === String ? $util.base64.encode(message.nonce, 0, message.nonce.length) : options.bytes === Array ? Array.prototype.slice.call(message.nonce) : message.nonce;
        if (message.version != null && message.hasOwnProperty("version"))
            object.version = message.version;
        return object;
    };

    /**
     * Converts this EncryptedData to JSON.
     * @function toJSON
     * @memberof EncryptedData
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    EncryptedData.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for EncryptedData
     * @function getTypeUrl
     * @memberof EncryptedData
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    EncryptedData.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/EncryptedData";
    };

    return EncryptedData;
})();

export const SignedUserRegistration = $root.SignedUserRegistration = (() => {

    /**
     * Properties of a SignedUserRegistration.
     * @exports ISignedUserRegistration
     * @interface ISignedUserRegistration
     * @property {Uint8Array|null} [signature] SignedUserRegistration signature
     * @property {Uint8Array|null} [address] SignedUserRegistration address
     * @property {SignedUserRegistration.IKeyBundle|null} [keyBundle] SignedUserRegistration keyBundle
     */

    /**
     * Constructs a new SignedUserRegistration.
     * @exports SignedUserRegistration
     * @classdesc Represents a SignedUserRegistration.
     * @implements ISignedUserRegistration
     * @constructor
     * @param {ISignedUserRegistration=} [properties] Properties to set
     */
    function SignedUserRegistration(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * SignedUserRegistration signature.
     * @member {Uint8Array} signature
     * @memberof SignedUserRegistration
     * @instance
     */
    SignedUserRegistration.prototype.signature = $util.newBuffer([]);

    /**
     * SignedUserRegistration address.
     * @member {Uint8Array} address
     * @memberof SignedUserRegistration
     * @instance
     */
    SignedUserRegistration.prototype.address = $util.newBuffer([]);

    /**
     * SignedUserRegistration keyBundle.
     * @member {SignedUserRegistration.IKeyBundle|null|undefined} keyBundle
     * @memberof SignedUserRegistration
     * @instance
     */
    SignedUserRegistration.prototype.keyBundle = null;

    /**
     * Creates a new SignedUserRegistration instance using the specified properties.
     * @function create
     * @memberof SignedUserRegistration
     * @static
     * @param {ISignedUserRegistration=} [properties] Properties to set
     * @returns {SignedUserRegistration} SignedUserRegistration instance
     */
    SignedUserRegistration.create = function create(properties) {
        return new SignedUserRegistration(properties);
    };

    /**
     * Encodes the specified SignedUserRegistration message. Does not implicitly {@link SignedUserRegistration.verify|verify} messages.
     * @function encode
     * @memberof SignedUserRegistration
     * @static
     * @param {ISignedUserRegistration} message SignedUserRegistration message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SignedUserRegistration.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.signature != null && Object.hasOwnProperty.call(message, "signature"))
            writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.signature);
        if (message.address != null && Object.hasOwnProperty.call(message, "address"))
            writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.address);
        if (message.keyBundle != null && Object.hasOwnProperty.call(message, "keyBundle"))
            $root.SignedUserRegistration.KeyBundle.encode(message.keyBundle, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified SignedUserRegistration message, length delimited. Does not implicitly {@link SignedUserRegistration.verify|verify} messages.
     * @function encodeDelimited
     * @memberof SignedUserRegistration
     * @static
     * @param {ISignedUserRegistration} message SignedUserRegistration message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SignedUserRegistration.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SignedUserRegistration message from the specified reader or buffer.
     * @function decode
     * @memberof SignedUserRegistration
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {SignedUserRegistration} SignedUserRegistration
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SignedUserRegistration.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.SignedUserRegistration();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.signature = reader.bytes();
                    break;
                }
            case 2: {
                    message.address = reader.bytes();
                    break;
                }
            case 3: {
                    message.keyBundle = $root.SignedUserRegistration.KeyBundle.decode(reader, reader.uint32());
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a SignedUserRegistration message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof SignedUserRegistration
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {SignedUserRegistration} SignedUserRegistration
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SignedUserRegistration.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SignedUserRegistration message.
     * @function verify
     * @memberof SignedUserRegistration
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SignedUserRegistration.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.signature != null && message.hasOwnProperty("signature"))
            if (!(message.signature && typeof message.signature.length === "number" || $util.isString(message.signature)))
                return "signature: buffer expected";
        if (message.address != null && message.hasOwnProperty("address"))
            if (!(message.address && typeof message.address.length === "number" || $util.isString(message.address)))
                return "address: buffer expected";
        if (message.keyBundle != null && message.hasOwnProperty("keyBundle")) {
            let error = $root.SignedUserRegistration.KeyBundle.verify(message.keyBundle);
            if (error)
                return "keyBundle." + error;
        }
        return null;
    };

    /**
     * Creates a SignedUserRegistration message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof SignedUserRegistration
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {SignedUserRegistration} SignedUserRegistration
     */
    SignedUserRegistration.fromObject = function fromObject(object) {
        if (object instanceof $root.SignedUserRegistration)
            return object;
        let message = new $root.SignedUserRegistration();
        if (object.signature != null)
            if (typeof object.signature === "string")
                $util.base64.decode(object.signature, message.signature = $util.newBuffer($util.base64.length(object.signature)), 0);
            else if (object.signature.length >= 0)
                message.signature = object.signature;
        if (object.address != null)
            if (typeof object.address === "string")
                $util.base64.decode(object.address, message.address = $util.newBuffer($util.base64.length(object.address)), 0);
            else if (object.address.length >= 0)
                message.address = object.address;
        if (object.keyBundle != null) {
            if (typeof object.keyBundle !== "object")
                throw TypeError(".SignedUserRegistration.keyBundle: object expected");
            message.keyBundle = $root.SignedUserRegistration.KeyBundle.fromObject(object.keyBundle);
        }
        return message;
    };

    /**
     * Creates a plain object from a SignedUserRegistration message. Also converts values to other types if specified.
     * @function toObject
     * @memberof SignedUserRegistration
     * @static
     * @param {SignedUserRegistration} message SignedUserRegistration
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SignedUserRegistration.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            if (options.bytes === String)
                object.signature = "";
            else {
                object.signature = [];
                if (options.bytes !== Array)
                    object.signature = $util.newBuffer(object.signature);
            }
            if (options.bytes === String)
                object.address = "";
            else {
                object.address = [];
                if (options.bytes !== Array)
                    object.address = $util.newBuffer(object.address);
            }
            object.keyBundle = null;
        }
        if (message.signature != null && message.hasOwnProperty("signature"))
            object.signature = options.bytes === String ? $util.base64.encode(message.signature, 0, message.signature.length) : options.bytes === Array ? Array.prototype.slice.call(message.signature) : message.signature;
        if (message.address != null && message.hasOwnProperty("address"))
            object.address = options.bytes === String ? $util.base64.encode(message.address, 0, message.address.length) : options.bytes === Array ? Array.prototype.slice.call(message.address) : message.address;
        if (message.keyBundle != null && message.hasOwnProperty("keyBundle"))
            object.keyBundle = $root.SignedUserRegistration.KeyBundle.toObject(message.keyBundle, options);
        return object;
    };

    /**
     * Converts this SignedUserRegistration to JSON.
     * @function toJSON
     * @memberof SignedUserRegistration
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SignedUserRegistration.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SignedUserRegistration
     * @function getTypeUrl
     * @memberof SignedUserRegistration
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SignedUserRegistration.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/SignedUserRegistration";
    };

    SignedUserRegistration.KeyBundle = (function() {

        /**
         * Properties of a KeyBundle.
         * @memberof SignedUserRegistration
         * @interface IKeyBundle
         * @property {Uint8Array|null} [signingAddress] KeyBundle signingAddress
         * @property {Uint8Array|null} [encryptionPublicKey] KeyBundle encryptionPublicKey
         */

        /**
         * Constructs a new KeyBundle.
         * @memberof SignedUserRegistration
         * @classdesc Represents a KeyBundle.
         * @implements IKeyBundle
         * @constructor
         * @param {SignedUserRegistration.IKeyBundle=} [properties] Properties to set
         */
        function KeyBundle(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * KeyBundle signingAddress.
         * @member {Uint8Array} signingAddress
         * @memberof SignedUserRegistration.KeyBundle
         * @instance
         */
        KeyBundle.prototype.signingAddress = $util.newBuffer([]);

        /**
         * KeyBundle encryptionPublicKey.
         * @member {Uint8Array} encryptionPublicKey
         * @memberof SignedUserRegistration.KeyBundle
         * @instance
         */
        KeyBundle.prototype.encryptionPublicKey = $util.newBuffer([]);

        /**
         * Creates a new KeyBundle instance using the specified properties.
         * @function create
         * @memberof SignedUserRegistration.KeyBundle
         * @static
         * @param {SignedUserRegistration.IKeyBundle=} [properties] Properties to set
         * @returns {SignedUserRegistration.KeyBundle} KeyBundle instance
         */
        KeyBundle.create = function create(properties) {
            return new KeyBundle(properties);
        };

        /**
         * Encodes the specified KeyBundle message. Does not implicitly {@link SignedUserRegistration.KeyBundle.verify|verify} messages.
         * @function encode
         * @memberof SignedUserRegistration.KeyBundle
         * @static
         * @param {SignedUserRegistration.IKeyBundle} message KeyBundle message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        KeyBundle.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.signingAddress != null && Object.hasOwnProperty.call(message, "signingAddress"))
                writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.signingAddress);
            if (message.encryptionPublicKey != null && Object.hasOwnProperty.call(message, "encryptionPublicKey"))
                writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.encryptionPublicKey);
            return writer;
        };

        /**
         * Encodes the specified KeyBundle message, length delimited. Does not implicitly {@link SignedUserRegistration.KeyBundle.verify|verify} messages.
         * @function encodeDelimited
         * @memberof SignedUserRegistration.KeyBundle
         * @static
         * @param {SignedUserRegistration.IKeyBundle} message KeyBundle message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        KeyBundle.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a KeyBundle message from the specified reader or buffer.
         * @function decode
         * @memberof SignedUserRegistration.KeyBundle
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {SignedUserRegistration.KeyBundle} KeyBundle
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        KeyBundle.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.SignedUserRegistration.KeyBundle();
            while (reader.pos < end) {
                let tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.signingAddress = reader.bytes();
                        break;
                    }
                case 2: {
                        message.encryptionPublicKey = reader.bytes();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a KeyBundle message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof SignedUserRegistration.KeyBundle
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {SignedUserRegistration.KeyBundle} KeyBundle
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        KeyBundle.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a KeyBundle message.
         * @function verify
         * @memberof SignedUserRegistration.KeyBundle
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        KeyBundle.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.signingAddress != null && message.hasOwnProperty("signingAddress"))
                if (!(message.signingAddress && typeof message.signingAddress.length === "number" || $util.isString(message.signingAddress)))
                    return "signingAddress: buffer expected";
            if (message.encryptionPublicKey != null && message.hasOwnProperty("encryptionPublicKey"))
                if (!(message.encryptionPublicKey && typeof message.encryptionPublicKey.length === "number" || $util.isString(message.encryptionPublicKey)))
                    return "encryptionPublicKey: buffer expected";
            return null;
        };

        /**
         * Creates a KeyBundle message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof SignedUserRegistration.KeyBundle
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {SignedUserRegistration.KeyBundle} KeyBundle
         */
        KeyBundle.fromObject = function fromObject(object) {
            if (object instanceof $root.SignedUserRegistration.KeyBundle)
                return object;
            let message = new $root.SignedUserRegistration.KeyBundle();
            if (object.signingAddress != null)
                if (typeof object.signingAddress === "string")
                    $util.base64.decode(object.signingAddress, message.signingAddress = $util.newBuffer($util.base64.length(object.signingAddress)), 0);
                else if (object.signingAddress.length >= 0)
                    message.signingAddress = object.signingAddress;
            if (object.encryptionPublicKey != null)
                if (typeof object.encryptionPublicKey === "string")
                    $util.base64.decode(object.encryptionPublicKey, message.encryptionPublicKey = $util.newBuffer($util.base64.length(object.encryptionPublicKey)), 0);
                else if (object.encryptionPublicKey.length >= 0)
                    message.encryptionPublicKey = object.encryptionPublicKey;
            return message;
        };

        /**
         * Creates a plain object from a KeyBundle message. Also converts values to other types if specified.
         * @function toObject
         * @memberof SignedUserRegistration.KeyBundle
         * @static
         * @param {SignedUserRegistration.KeyBundle} message KeyBundle
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        KeyBundle.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                if (options.bytes === String)
                    object.signingAddress = "";
                else {
                    object.signingAddress = [];
                    if (options.bytes !== Array)
                        object.signingAddress = $util.newBuffer(object.signingAddress);
                }
                if (options.bytes === String)
                    object.encryptionPublicKey = "";
                else {
                    object.encryptionPublicKey = [];
                    if (options.bytes !== Array)
                        object.encryptionPublicKey = $util.newBuffer(object.encryptionPublicKey);
                }
            }
            if (message.signingAddress != null && message.hasOwnProperty("signingAddress"))
                object.signingAddress = options.bytes === String ? $util.base64.encode(message.signingAddress, 0, message.signingAddress.length) : options.bytes === Array ? Array.prototype.slice.call(message.signingAddress) : message.signingAddress;
            if (message.encryptionPublicKey != null && message.hasOwnProperty("encryptionPublicKey"))
                object.encryptionPublicKey = options.bytes === String ? $util.base64.encode(message.encryptionPublicKey, 0, message.encryptionPublicKey.length) : options.bytes === Array ? Array.prototype.slice.call(message.encryptionPublicKey) : message.encryptionPublicKey;
            return object;
        };

        /**
         * Converts this KeyBundle to JSON.
         * @function toJSON
         * @memberof SignedUserRegistration.KeyBundle
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        KeyBundle.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for KeyBundle
         * @function getTypeUrl
         * @memberof SignedUserRegistration.KeyBundle
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        KeyBundle.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/SignedUserRegistration.KeyBundle";
        };

        return KeyBundle;
    })();

    return SignedUserRegistration;
})();

export const RoomRegistration = $root.RoomRegistration = (() => {

    /**
     * Properties of a RoomRegistration.
     * @exports IRoomRegistration
     * @interface IRoomRegistration
     * @property {Uint8Array|null} [creator] RoomRegistration creator
     * @property {Array.<ISignedUserRegistration>|null} [members] RoomRegistration members
     */

    /**
     * Constructs a new RoomRegistration.
     * @exports RoomRegistration
     * @classdesc Represents a RoomRegistration.
     * @implements IRoomRegistration
     * @constructor
     * @param {IRoomRegistration=} [properties] Properties to set
     */
    function RoomRegistration(properties) {
        this.members = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * RoomRegistration creator.
     * @member {Uint8Array} creator
     * @memberof RoomRegistration
     * @instance
     */
    RoomRegistration.prototype.creator = $util.newBuffer([]);

    /**
     * RoomRegistration members.
     * @member {Array.<ISignedUserRegistration>} members
     * @memberof RoomRegistration
     * @instance
     */
    RoomRegistration.prototype.members = $util.emptyArray;

    /**
     * Creates a new RoomRegistration instance using the specified properties.
     * @function create
     * @memberof RoomRegistration
     * @static
     * @param {IRoomRegistration=} [properties] Properties to set
     * @returns {RoomRegistration} RoomRegistration instance
     */
    RoomRegistration.create = function create(properties) {
        return new RoomRegistration(properties);
    };

    /**
     * Encodes the specified RoomRegistration message. Does not implicitly {@link RoomRegistration.verify|verify} messages.
     * @function encode
     * @memberof RoomRegistration
     * @static
     * @param {IRoomRegistration} message RoomRegistration message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RoomRegistration.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.creator != null && Object.hasOwnProperty.call(message, "creator"))
            writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.creator);
        if (message.members != null && message.members.length)
            for (let i = 0; i < message.members.length; ++i)
                $root.SignedUserRegistration.encode(message.members[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified RoomRegistration message, length delimited. Does not implicitly {@link RoomRegistration.verify|verify} messages.
     * @function encodeDelimited
     * @memberof RoomRegistration
     * @static
     * @param {IRoomRegistration} message RoomRegistration message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RoomRegistration.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RoomRegistration message from the specified reader or buffer.
     * @function decode
     * @memberof RoomRegistration
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {RoomRegistration} RoomRegistration
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RoomRegistration.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.RoomRegistration();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.creator = reader.bytes();
                    break;
                }
            case 2: {
                    if (!(message.members && message.members.length))
                        message.members = [];
                    message.members.push($root.SignedUserRegistration.decode(reader, reader.uint32()));
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a RoomRegistration message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof RoomRegistration
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {RoomRegistration} RoomRegistration
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RoomRegistration.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RoomRegistration message.
     * @function verify
     * @memberof RoomRegistration
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RoomRegistration.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.creator != null && message.hasOwnProperty("creator"))
            if (!(message.creator && typeof message.creator.length === "number" || $util.isString(message.creator)))
                return "creator: buffer expected";
        if (message.members != null && message.hasOwnProperty("members")) {
            if (!Array.isArray(message.members))
                return "members: array expected";
            for (let i = 0; i < message.members.length; ++i) {
                let error = $root.SignedUserRegistration.verify(message.members[i]);
                if (error)
                    return "members." + error;
            }
        }
        return null;
    };

    /**
     * Creates a RoomRegistration message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof RoomRegistration
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {RoomRegistration} RoomRegistration
     */
    RoomRegistration.fromObject = function fromObject(object) {
        if (object instanceof $root.RoomRegistration)
            return object;
        let message = new $root.RoomRegistration();
        if (object.creator != null)
            if (typeof object.creator === "string")
                $util.base64.decode(object.creator, message.creator = $util.newBuffer($util.base64.length(object.creator)), 0);
            else if (object.creator.length >= 0)
                message.creator = object.creator;
        if (object.members) {
            if (!Array.isArray(object.members))
                throw TypeError(".RoomRegistration.members: array expected");
            message.members = [];
            for (let i = 0; i < object.members.length; ++i) {
                if (typeof object.members[i] !== "object")
                    throw TypeError(".RoomRegistration.members: object expected");
                message.members[i] = $root.SignedUserRegistration.fromObject(object.members[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a RoomRegistration message. Also converts values to other types if specified.
     * @function toObject
     * @memberof RoomRegistration
     * @static
     * @param {RoomRegistration} message RoomRegistration
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RoomRegistration.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.members = [];
        if (options.defaults)
            if (options.bytes === String)
                object.creator = "";
            else {
                object.creator = [];
                if (options.bytes !== Array)
                    object.creator = $util.newBuffer(object.creator);
            }
        if (message.creator != null && message.hasOwnProperty("creator"))
            object.creator = options.bytes === String ? $util.base64.encode(message.creator, 0, message.creator.length) : options.bytes === Array ? Array.prototype.slice.call(message.creator) : message.creator;
        if (message.members && message.members.length) {
            object.members = [];
            for (let j = 0; j < message.members.length; ++j)
                object.members[j] = $root.SignedUserRegistration.toObject(message.members[j], options);
        }
        return object;
    };

    /**
     * Converts this RoomRegistration to JSON.
     * @function toJSON
     * @memberof RoomRegistration
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RoomRegistration.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RoomRegistration
     * @function getTypeUrl
     * @memberof RoomRegistration
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RoomRegistration.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/RoomRegistration";
    };

    return RoomRegistration;
})();

export { $root as default };
