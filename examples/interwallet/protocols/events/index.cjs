/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.SignedEvent = (function() {

    /**
     * Properties of a SignedEvent.
     * @exports ISignedEvent
     * @interface ISignedEvent
     * @property {Uint8Array|null} [signature] SignedEvent signature
     * @property {Uint8Array|null} [payload] SignedEvent payload
     */

    /**
     * Constructs a new SignedEvent.
     * @exports SignedEvent
     * @classdesc Represents a SignedEvent.
     * @implements ISignedEvent
     * @constructor
     * @param {ISignedEvent=} [properties] Properties to set
     */
    function SignedEvent(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * SignedEvent signature.
     * @member {Uint8Array} signature
     * @memberof SignedEvent
     * @instance
     */
    SignedEvent.prototype.signature = $util.newBuffer([]);

    /**
     * SignedEvent payload.
     * @member {Uint8Array} payload
     * @memberof SignedEvent
     * @instance
     */
    SignedEvent.prototype.payload = $util.newBuffer([]);

    /**
     * Creates a new SignedEvent instance using the specified properties.
     * @function create
     * @memberof SignedEvent
     * @static
     * @param {ISignedEvent=} [properties] Properties to set
     * @returns {SignedEvent} SignedEvent instance
     */
    SignedEvent.create = function create(properties) {
        return new SignedEvent(properties);
    };

    /**
     * Encodes the specified SignedEvent message. Does not implicitly {@link SignedEvent.verify|verify} messages.
     * @function encode
     * @memberof SignedEvent
     * @static
     * @param {ISignedEvent} message SignedEvent message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SignedEvent.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.signature != null && Object.hasOwnProperty.call(message, "signature"))
            writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.signature);
        if (message.payload != null && Object.hasOwnProperty.call(message, "payload"))
            writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.payload);
        return writer;
    };

    /**
     * Encodes the specified SignedEvent message, length delimited. Does not implicitly {@link SignedEvent.verify|verify} messages.
     * @function encodeDelimited
     * @memberof SignedEvent
     * @static
     * @param {ISignedEvent} message SignedEvent message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SignedEvent.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SignedEvent message from the specified reader or buffer.
     * @function decode
     * @memberof SignedEvent
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {SignedEvent} SignedEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SignedEvent.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.SignedEvent();
        while (reader.pos < end) {
            var tag = reader.uint32();
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
     * Decodes a SignedEvent message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof SignedEvent
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {SignedEvent} SignedEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SignedEvent.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SignedEvent message.
     * @function verify
     * @memberof SignedEvent
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SignedEvent.verify = function verify(message) {
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
     * Creates a SignedEvent message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof SignedEvent
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {SignedEvent} SignedEvent
     */
    SignedEvent.fromObject = function fromObject(object) {
        if (object instanceof $root.SignedEvent)
            return object;
        var message = new $root.SignedEvent();
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
     * Creates a plain object from a SignedEvent message. Also converts values to other types if specified.
     * @function toObject
     * @memberof SignedEvent
     * @static
     * @param {SignedEvent} message SignedEvent
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SignedEvent.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
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
     * Converts this SignedEvent to JSON.
     * @function toJSON
     * @memberof SignedEvent
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SignedEvent.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SignedEvent
     * @function getTypeUrl
     * @memberof SignedEvent
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SignedEvent.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/SignedEvent";
    };

    return SignedEvent;
})();

$root.EncryptedEvent = (function() {

    /**
     * Properties of an EncryptedEvent.
     * @exports IEncryptedEvent
     * @interface IEncryptedEvent
     * @property {Uint8Array|null} [publicKey] EncryptedEvent publicKey
     * @property {Uint8Array|null} [ciphertext] EncryptedEvent ciphertext
     * @property {Uint8Array|null} [ephemPublicKey] EncryptedEvent ephemPublicKey
     * @property {Uint8Array|null} [nonce] EncryptedEvent nonce
     * @property {string|null} [version] EncryptedEvent version
     */

    /**
     * Constructs a new EncryptedEvent.
     * @exports EncryptedEvent
     * @classdesc Represents an EncryptedEvent.
     * @implements IEncryptedEvent
     * @constructor
     * @param {IEncryptedEvent=} [properties] Properties to set
     */
    function EncryptedEvent(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * EncryptedEvent publicKey.
     * @member {Uint8Array} publicKey
     * @memberof EncryptedEvent
     * @instance
     */
    EncryptedEvent.prototype.publicKey = $util.newBuffer([]);

    /**
     * EncryptedEvent ciphertext.
     * @member {Uint8Array} ciphertext
     * @memberof EncryptedEvent
     * @instance
     */
    EncryptedEvent.prototype.ciphertext = $util.newBuffer([]);

    /**
     * EncryptedEvent ephemPublicKey.
     * @member {Uint8Array} ephemPublicKey
     * @memberof EncryptedEvent
     * @instance
     */
    EncryptedEvent.prototype.ephemPublicKey = $util.newBuffer([]);

    /**
     * EncryptedEvent nonce.
     * @member {Uint8Array} nonce
     * @memberof EncryptedEvent
     * @instance
     */
    EncryptedEvent.prototype.nonce = $util.newBuffer([]);

    /**
     * EncryptedEvent version.
     * @member {string} version
     * @memberof EncryptedEvent
     * @instance
     */
    EncryptedEvent.prototype.version = "";

    /**
     * Creates a new EncryptedEvent instance using the specified properties.
     * @function create
     * @memberof EncryptedEvent
     * @static
     * @param {IEncryptedEvent=} [properties] Properties to set
     * @returns {EncryptedEvent} EncryptedEvent instance
     */
    EncryptedEvent.create = function create(properties) {
        return new EncryptedEvent(properties);
    };

    /**
     * Encodes the specified EncryptedEvent message. Does not implicitly {@link EncryptedEvent.verify|verify} messages.
     * @function encode
     * @memberof EncryptedEvent
     * @static
     * @param {IEncryptedEvent} message EncryptedEvent message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    EncryptedEvent.encode = function encode(message, writer) {
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
     * Encodes the specified EncryptedEvent message, length delimited. Does not implicitly {@link EncryptedEvent.verify|verify} messages.
     * @function encodeDelimited
     * @memberof EncryptedEvent
     * @static
     * @param {IEncryptedEvent} message EncryptedEvent message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    EncryptedEvent.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an EncryptedEvent message from the specified reader or buffer.
     * @function decode
     * @memberof EncryptedEvent
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {EncryptedEvent} EncryptedEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    EncryptedEvent.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.EncryptedEvent();
        while (reader.pos < end) {
            var tag = reader.uint32();
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
     * Decodes an EncryptedEvent message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof EncryptedEvent
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {EncryptedEvent} EncryptedEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    EncryptedEvent.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an EncryptedEvent message.
     * @function verify
     * @memberof EncryptedEvent
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    EncryptedEvent.verify = function verify(message) {
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
     * Creates an EncryptedEvent message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof EncryptedEvent
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {EncryptedEvent} EncryptedEvent
     */
    EncryptedEvent.fromObject = function fromObject(object) {
        if (object instanceof $root.EncryptedEvent)
            return object;
        var message = new $root.EncryptedEvent();
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
     * Creates a plain object from an EncryptedEvent message. Also converts values to other types if specified.
     * @function toObject
     * @memberof EncryptedEvent
     * @static
     * @param {EncryptedEvent} message EncryptedEvent
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    EncryptedEvent.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
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
     * Converts this EncryptedEvent to JSON.
     * @function toJSON
     * @memberof EncryptedEvent
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    EncryptedEvent.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for EncryptedEvent
     * @function getTypeUrl
     * @memberof EncryptedEvent
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    EncryptedEvent.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/EncryptedEvent";
    };

    return EncryptedEvent;
})();

$root.SignedKeyBundle = (function() {

    /**
     * Properties of a SignedKeyBundle.
     * @exports ISignedKeyBundle
     * @interface ISignedKeyBundle
     * @property {Uint8Array|null} [signature] SignedKeyBundle signature
     * @property {Uint8Array|null} [signingAddress] SignedKeyBundle signingAddress
     * @property {Uint8Array|null} [encryptionPublicKey] SignedKeyBundle encryptionPublicKey
     */

    /**
     * Constructs a new SignedKeyBundle.
     * @exports SignedKeyBundle
     * @classdesc Represents a SignedKeyBundle.
     * @implements ISignedKeyBundle
     * @constructor
     * @param {ISignedKeyBundle=} [properties] Properties to set
     */
    function SignedKeyBundle(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * SignedKeyBundle signature.
     * @member {Uint8Array} signature
     * @memberof SignedKeyBundle
     * @instance
     */
    SignedKeyBundle.prototype.signature = $util.newBuffer([]);

    /**
     * SignedKeyBundle signingAddress.
     * @member {Uint8Array} signingAddress
     * @memberof SignedKeyBundle
     * @instance
     */
    SignedKeyBundle.prototype.signingAddress = $util.newBuffer([]);

    /**
     * SignedKeyBundle encryptionPublicKey.
     * @member {Uint8Array} encryptionPublicKey
     * @memberof SignedKeyBundle
     * @instance
     */
    SignedKeyBundle.prototype.encryptionPublicKey = $util.newBuffer([]);

    /**
     * Creates a new SignedKeyBundle instance using the specified properties.
     * @function create
     * @memberof SignedKeyBundle
     * @static
     * @param {ISignedKeyBundle=} [properties] Properties to set
     * @returns {SignedKeyBundle} SignedKeyBundle instance
     */
    SignedKeyBundle.create = function create(properties) {
        return new SignedKeyBundle(properties);
    };

    /**
     * Encodes the specified SignedKeyBundle message. Does not implicitly {@link SignedKeyBundle.verify|verify} messages.
     * @function encode
     * @memberof SignedKeyBundle
     * @static
     * @param {ISignedKeyBundle} message SignedKeyBundle message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SignedKeyBundle.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.signature != null && Object.hasOwnProperty.call(message, "signature"))
            writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.signature);
        if (message.signingAddress != null && Object.hasOwnProperty.call(message, "signingAddress"))
            writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.signingAddress);
        if (message.encryptionPublicKey != null && Object.hasOwnProperty.call(message, "encryptionPublicKey"))
            writer.uint32(/* id 3, wireType 2 =*/26).bytes(message.encryptionPublicKey);
        return writer;
    };

    /**
     * Encodes the specified SignedKeyBundle message, length delimited. Does not implicitly {@link SignedKeyBundle.verify|verify} messages.
     * @function encodeDelimited
     * @memberof SignedKeyBundle
     * @static
     * @param {ISignedKeyBundle} message SignedKeyBundle message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SignedKeyBundle.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SignedKeyBundle message from the specified reader or buffer.
     * @function decode
     * @memberof SignedKeyBundle
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {SignedKeyBundle} SignedKeyBundle
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SignedKeyBundle.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.SignedKeyBundle();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.signature = reader.bytes();
                    break;
                }
            case 2: {
                    message.signingAddress = reader.bytes();
                    break;
                }
            case 3: {
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
     * Decodes a SignedKeyBundle message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof SignedKeyBundle
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {SignedKeyBundle} SignedKeyBundle
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SignedKeyBundle.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SignedKeyBundle message.
     * @function verify
     * @memberof SignedKeyBundle
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SignedKeyBundle.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.signature != null && message.hasOwnProperty("signature"))
            if (!(message.signature && typeof message.signature.length === "number" || $util.isString(message.signature)))
                return "signature: buffer expected";
        if (message.signingAddress != null && message.hasOwnProperty("signingAddress"))
            if (!(message.signingAddress && typeof message.signingAddress.length === "number" || $util.isString(message.signingAddress)))
                return "signingAddress: buffer expected";
        if (message.encryptionPublicKey != null && message.hasOwnProperty("encryptionPublicKey"))
            if (!(message.encryptionPublicKey && typeof message.encryptionPublicKey.length === "number" || $util.isString(message.encryptionPublicKey)))
                return "encryptionPublicKey: buffer expected";
        return null;
    };

    /**
     * Creates a SignedKeyBundle message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof SignedKeyBundle
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {SignedKeyBundle} SignedKeyBundle
     */
    SignedKeyBundle.fromObject = function fromObject(object) {
        if (object instanceof $root.SignedKeyBundle)
            return object;
        var message = new $root.SignedKeyBundle();
        if (object.signature != null)
            if (typeof object.signature === "string")
                $util.base64.decode(object.signature, message.signature = $util.newBuffer($util.base64.length(object.signature)), 0);
            else if (object.signature.length >= 0)
                message.signature = object.signature;
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
     * Creates a plain object from a SignedKeyBundle message. Also converts values to other types if specified.
     * @function toObject
     * @memberof SignedKeyBundle
     * @static
     * @param {SignedKeyBundle} message SignedKeyBundle
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SignedKeyBundle.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            if (options.bytes === String)
                object.signature = "";
            else {
                object.signature = [];
                if (options.bytes !== Array)
                    object.signature = $util.newBuffer(object.signature);
            }
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
        if (message.signature != null && message.hasOwnProperty("signature"))
            object.signature = options.bytes === String ? $util.base64.encode(message.signature, 0, message.signature.length) : options.bytes === Array ? Array.prototype.slice.call(message.signature) : message.signature;
        if (message.signingAddress != null && message.hasOwnProperty("signingAddress"))
            object.signingAddress = options.bytes === String ? $util.base64.encode(message.signingAddress, 0, message.signingAddress.length) : options.bytes === Array ? Array.prototype.slice.call(message.signingAddress) : message.signingAddress;
        if (message.encryptionPublicKey != null && message.hasOwnProperty("encryptionPublicKey"))
            object.encryptionPublicKey = options.bytes === String ? $util.base64.encode(message.encryptionPublicKey, 0, message.encryptionPublicKey.length) : options.bytes === Array ? Array.prototype.slice.call(message.encryptionPublicKey) : message.encryptionPublicKey;
        return object;
    };

    /**
     * Converts this SignedKeyBundle to JSON.
     * @function toJSON
     * @memberof SignedKeyBundle
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SignedKeyBundle.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SignedKeyBundle
     * @function getTypeUrl
     * @memberof SignedKeyBundle
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SignedKeyBundle.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/SignedKeyBundle";
    };

    return SignedKeyBundle;
})();

$root.Room = (function() {

    /**
     * Properties of a Room.
     * @exports IRoom
     * @interface IRoom
     * @property {string|null} [topic] Room topic
     * @property {Array.<Uint8Array>|null} [members] Room members
     */

    /**
     * Constructs a new Room.
     * @exports Room
     * @classdesc Represents a Room.
     * @implements IRoom
     * @constructor
     * @param {IRoom=} [properties] Properties to set
     */
    function Room(properties) {
        this.members = [];
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Room topic.
     * @member {string} topic
     * @memberof Room
     * @instance
     */
    Room.prototype.topic = "";

    /**
     * Room members.
     * @member {Array.<Uint8Array>} members
     * @memberof Room
     * @instance
     */
    Room.prototype.members = $util.emptyArray;

    /**
     * Creates a new Room instance using the specified properties.
     * @function create
     * @memberof Room
     * @static
     * @param {IRoom=} [properties] Properties to set
     * @returns {Room} Room instance
     */
    Room.create = function create(properties) {
        return new Room(properties);
    };

    /**
     * Encodes the specified Room message. Does not implicitly {@link Room.verify|verify} messages.
     * @function encode
     * @memberof Room
     * @static
     * @param {IRoom} message Room message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Room.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.topic != null && Object.hasOwnProperty.call(message, "topic"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.topic);
        if (message.members != null && message.members.length)
            for (var i = 0; i < message.members.length; ++i)
                writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.members[i]);
        return writer;
    };

    /**
     * Encodes the specified Room message, length delimited. Does not implicitly {@link Room.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Room
     * @static
     * @param {IRoom} message Room message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Room.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Room message from the specified reader or buffer.
     * @function decode
     * @memberof Room
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Room} Room
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Room.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Room();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.topic = reader.string();
                    break;
                }
            case 2: {
                    if (!(message.members && message.members.length))
                        message.members = [];
                    message.members.push(reader.bytes());
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
     * Decodes a Room message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Room
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Room} Room
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Room.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Room message.
     * @function verify
     * @memberof Room
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Room.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.topic != null && message.hasOwnProperty("topic"))
            if (!$util.isString(message.topic))
                return "topic: string expected";
        if (message.members != null && message.hasOwnProperty("members")) {
            if (!Array.isArray(message.members))
                return "members: array expected";
            for (var i = 0; i < message.members.length; ++i)
                if (!(message.members[i] && typeof message.members[i].length === "number" || $util.isString(message.members[i])))
                    return "members: buffer[] expected";
        }
        return null;
    };

    /**
     * Creates a Room message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Room
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Room} Room
     */
    Room.fromObject = function fromObject(object) {
        if (object instanceof $root.Room)
            return object;
        var message = new $root.Room();
        if (object.topic != null)
            message.topic = String(object.topic);
        if (object.members) {
            if (!Array.isArray(object.members))
                throw TypeError(".Room.members: array expected");
            message.members = [];
            for (var i = 0; i < object.members.length; ++i)
                if (typeof object.members[i] === "string")
                    $util.base64.decode(object.members[i], message.members[i] = $util.newBuffer($util.base64.length(object.members[i])), 0);
                else if (object.members[i].length >= 0)
                    message.members[i] = object.members[i];
        }
        return message;
    };

    /**
     * Creates a plain object from a Room message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Room
     * @static
     * @param {Room} message Room
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Room.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.arrays || options.defaults)
            object.members = [];
        if (options.defaults)
            object.topic = "";
        if (message.topic != null && message.hasOwnProperty("topic"))
            object.topic = message.topic;
        if (message.members && message.members.length) {
            object.members = [];
            for (var j = 0; j < message.members.length; ++j)
                object.members[j] = options.bytes === String ? $util.base64.encode(message.members[j], 0, message.members[j].length) : options.bytes === Array ? Array.prototype.slice.call(message.members[j]) : message.members[j];
        }
        return object;
    };

    /**
     * Converts this Room to JSON.
     * @function toJSON
     * @memberof Room
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Room.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Room
     * @function getTypeUrl
     * @memberof Room
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Room.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/Room";
    };

    return Room;
})();

module.exports = $root;
