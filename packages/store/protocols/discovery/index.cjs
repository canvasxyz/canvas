/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.DiscoveryRecord = (function() {

    /**
     * Properties of a DiscoveryRecord.
     * @exports IDiscoveryRecord
     * @interface IDiscoveryRecord
     * @property {Array.<Uint8Array>|null} [addrs] DiscoveryRecord addrs
     * @property {Array.<string>|null} [topics] DiscoveryRecord topics
     */

    /**
     * Constructs a new DiscoveryRecord.
     * @exports DiscoveryRecord
     * @classdesc Represents a DiscoveryRecord.
     * @implements IDiscoveryRecord
     * @constructor
     * @param {IDiscoveryRecord=} [properties] Properties to set
     */
    function DiscoveryRecord(properties) {
        this.addrs = [];
        this.topics = [];
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * DiscoveryRecord addrs.
     * @member {Array.<Uint8Array>} addrs
     * @memberof DiscoveryRecord
     * @instance
     */
    DiscoveryRecord.prototype.addrs = $util.emptyArray;

    /**
     * DiscoveryRecord topics.
     * @member {Array.<string>} topics
     * @memberof DiscoveryRecord
     * @instance
     */
    DiscoveryRecord.prototype.topics = $util.emptyArray;

    /**
     * Creates a new DiscoveryRecord instance using the specified properties.
     * @function create
     * @memberof DiscoveryRecord
     * @static
     * @param {IDiscoveryRecord=} [properties] Properties to set
     * @returns {DiscoveryRecord} DiscoveryRecord instance
     */
    DiscoveryRecord.create = function create(properties) {
        return new DiscoveryRecord(properties);
    };

    /**
     * Encodes the specified DiscoveryRecord message. Does not implicitly {@link DiscoveryRecord.verify|verify} messages.
     * @function encode
     * @memberof DiscoveryRecord
     * @static
     * @param {IDiscoveryRecord} message DiscoveryRecord message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DiscoveryRecord.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.addrs != null && message.addrs.length)
            for (var i = 0; i < message.addrs.length; ++i)
                writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.addrs[i]);
        if (message.topics != null && message.topics.length)
            for (var i = 0; i < message.topics.length; ++i)
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.topics[i]);
        return writer;
    };

    /**
     * Encodes the specified DiscoveryRecord message, length delimited. Does not implicitly {@link DiscoveryRecord.verify|verify} messages.
     * @function encodeDelimited
     * @memberof DiscoveryRecord
     * @static
     * @param {IDiscoveryRecord} message DiscoveryRecord message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DiscoveryRecord.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a DiscoveryRecord message from the specified reader or buffer.
     * @function decode
     * @memberof DiscoveryRecord
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {DiscoveryRecord} DiscoveryRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DiscoveryRecord.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.DiscoveryRecord();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 2: {
                    if (!(message.addrs && message.addrs.length))
                        message.addrs = [];
                    message.addrs.push(reader.bytes());
                    break;
                }
            case 3: {
                    if (!(message.topics && message.topics.length))
                        message.topics = [];
                    message.topics.push(reader.string());
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
     * Decodes a DiscoveryRecord message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof DiscoveryRecord
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {DiscoveryRecord} DiscoveryRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DiscoveryRecord.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a DiscoveryRecord message.
     * @function verify
     * @memberof DiscoveryRecord
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    DiscoveryRecord.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.addrs != null && message.hasOwnProperty("addrs")) {
            if (!Array.isArray(message.addrs))
                return "addrs: array expected";
            for (var i = 0; i < message.addrs.length; ++i)
                if (!(message.addrs[i] && typeof message.addrs[i].length === "number" || $util.isString(message.addrs[i])))
                    return "addrs: buffer[] expected";
        }
        if (message.topics != null && message.hasOwnProperty("topics")) {
            if (!Array.isArray(message.topics))
                return "topics: array expected";
            for (var i = 0; i < message.topics.length; ++i)
                if (!$util.isString(message.topics[i]))
                    return "topics: string[] expected";
        }
        return null;
    };

    /**
     * Creates a DiscoveryRecord message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof DiscoveryRecord
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {DiscoveryRecord} DiscoveryRecord
     */
    DiscoveryRecord.fromObject = function fromObject(object) {
        if (object instanceof $root.DiscoveryRecord)
            return object;
        var message = new $root.DiscoveryRecord();
        if (object.addrs) {
            if (!Array.isArray(object.addrs))
                throw TypeError(".DiscoveryRecord.addrs: array expected");
            message.addrs = [];
            for (var i = 0; i < object.addrs.length; ++i)
                if (typeof object.addrs[i] === "string")
                    $util.base64.decode(object.addrs[i], message.addrs[i] = $util.newBuffer($util.base64.length(object.addrs[i])), 0);
                else if (object.addrs[i].length >= 0)
                    message.addrs[i] = object.addrs[i];
        }
        if (object.topics) {
            if (!Array.isArray(object.topics))
                throw TypeError(".DiscoveryRecord.topics: array expected");
            message.topics = [];
            for (var i = 0; i < object.topics.length; ++i)
                message.topics[i] = String(object.topics[i]);
        }
        return message;
    };

    /**
     * Creates a plain object from a DiscoveryRecord message. Also converts values to other types if specified.
     * @function toObject
     * @memberof DiscoveryRecord
     * @static
     * @param {DiscoveryRecord} message DiscoveryRecord
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    DiscoveryRecord.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.arrays || options.defaults) {
            object.addrs = [];
            object.topics = [];
        }
        if (message.addrs && message.addrs.length) {
            object.addrs = [];
            for (var j = 0; j < message.addrs.length; ++j)
                object.addrs[j] = options.bytes === String ? $util.base64.encode(message.addrs[j], 0, message.addrs[j].length) : options.bytes === Array ? Array.prototype.slice.call(message.addrs[j]) : message.addrs[j];
        }
        if (message.topics && message.topics.length) {
            object.topics = [];
            for (var j = 0; j < message.topics.length; ++j)
                object.topics[j] = message.topics[j];
        }
        return object;
    };

    /**
     * Converts this DiscoveryRecord to JSON.
     * @function toJSON
     * @memberof DiscoveryRecord
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    DiscoveryRecord.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for DiscoveryRecord
     * @function getTypeUrl
     * @memberof DiscoveryRecord
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    DiscoveryRecord.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/DiscoveryRecord";
    };

    return DiscoveryRecord;
})();

$root.SignedDiscoveryRecord = (function() {

    /**
     * Properties of a SignedDiscoveryRecord.
     * @exports ISignedDiscoveryRecord
     * @interface ISignedDiscoveryRecord
     * @property {Uint8Array|null} [from] SignedDiscoveryRecord from
     * @property {Uint8Array|null} [data] SignedDiscoveryRecord data
     * @property {Uint8Array|null} [seqno] SignedDiscoveryRecord seqno
     * @property {string|null} [topic] SignedDiscoveryRecord topic
     * @property {Uint8Array|null} [signature] SignedDiscoveryRecord signature
     * @property {Uint8Array|null} [key] SignedDiscoveryRecord key
     */

    /**
     * Constructs a new SignedDiscoveryRecord.
     * @exports SignedDiscoveryRecord
     * @classdesc Represents a SignedDiscoveryRecord.
     * @implements ISignedDiscoveryRecord
     * @constructor
     * @param {ISignedDiscoveryRecord=} [properties] Properties to set
     */
    function SignedDiscoveryRecord(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * SignedDiscoveryRecord from.
     * @member {Uint8Array} from
     * @memberof SignedDiscoveryRecord
     * @instance
     */
    SignedDiscoveryRecord.prototype.from = $util.newBuffer([]);

    /**
     * SignedDiscoveryRecord data.
     * @member {Uint8Array} data
     * @memberof SignedDiscoveryRecord
     * @instance
     */
    SignedDiscoveryRecord.prototype.data = $util.newBuffer([]);

    /**
     * SignedDiscoveryRecord seqno.
     * @member {Uint8Array} seqno
     * @memberof SignedDiscoveryRecord
     * @instance
     */
    SignedDiscoveryRecord.prototype.seqno = $util.newBuffer([]);

    /**
     * SignedDiscoveryRecord topic.
     * @member {string} topic
     * @memberof SignedDiscoveryRecord
     * @instance
     */
    SignedDiscoveryRecord.prototype.topic = "";

    /**
     * SignedDiscoveryRecord signature.
     * @member {Uint8Array} signature
     * @memberof SignedDiscoveryRecord
     * @instance
     */
    SignedDiscoveryRecord.prototype.signature = $util.newBuffer([]);

    /**
     * SignedDiscoveryRecord key.
     * @member {Uint8Array} key
     * @memberof SignedDiscoveryRecord
     * @instance
     */
    SignedDiscoveryRecord.prototype.key = $util.newBuffer([]);

    /**
     * Creates a new SignedDiscoveryRecord instance using the specified properties.
     * @function create
     * @memberof SignedDiscoveryRecord
     * @static
     * @param {ISignedDiscoveryRecord=} [properties] Properties to set
     * @returns {SignedDiscoveryRecord} SignedDiscoveryRecord instance
     */
    SignedDiscoveryRecord.create = function create(properties) {
        return new SignedDiscoveryRecord(properties);
    };

    /**
     * Encodes the specified SignedDiscoveryRecord message. Does not implicitly {@link SignedDiscoveryRecord.verify|verify} messages.
     * @function encode
     * @memberof SignedDiscoveryRecord
     * @static
     * @param {ISignedDiscoveryRecord} message SignedDiscoveryRecord message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SignedDiscoveryRecord.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.from != null && Object.hasOwnProperty.call(message, "from"))
            writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.from);
        if (message.data != null && Object.hasOwnProperty.call(message, "data"))
            writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.data);
        if (message.seqno != null && Object.hasOwnProperty.call(message, "seqno"))
            writer.uint32(/* id 3, wireType 2 =*/26).bytes(message.seqno);
        if (message.topic != null && Object.hasOwnProperty.call(message, "topic"))
            writer.uint32(/* id 4, wireType 2 =*/34).string(message.topic);
        if (message.signature != null && Object.hasOwnProperty.call(message, "signature"))
            writer.uint32(/* id 5, wireType 2 =*/42).bytes(message.signature);
        if (message.key != null && Object.hasOwnProperty.call(message, "key"))
            writer.uint32(/* id 6, wireType 2 =*/50).bytes(message.key);
        return writer;
    };

    /**
     * Encodes the specified SignedDiscoveryRecord message, length delimited. Does not implicitly {@link SignedDiscoveryRecord.verify|verify} messages.
     * @function encodeDelimited
     * @memberof SignedDiscoveryRecord
     * @static
     * @param {ISignedDiscoveryRecord} message SignedDiscoveryRecord message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SignedDiscoveryRecord.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SignedDiscoveryRecord message from the specified reader or buffer.
     * @function decode
     * @memberof SignedDiscoveryRecord
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {SignedDiscoveryRecord} SignedDiscoveryRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SignedDiscoveryRecord.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.SignedDiscoveryRecord();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.from = reader.bytes();
                    break;
                }
            case 2: {
                    message.data = reader.bytes();
                    break;
                }
            case 3: {
                    message.seqno = reader.bytes();
                    break;
                }
            case 4: {
                    message.topic = reader.string();
                    break;
                }
            case 5: {
                    message.signature = reader.bytes();
                    break;
                }
            case 6: {
                    message.key = reader.bytes();
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
     * Decodes a SignedDiscoveryRecord message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof SignedDiscoveryRecord
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {SignedDiscoveryRecord} SignedDiscoveryRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SignedDiscoveryRecord.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SignedDiscoveryRecord message.
     * @function verify
     * @memberof SignedDiscoveryRecord
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SignedDiscoveryRecord.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.from != null && message.hasOwnProperty("from"))
            if (!(message.from && typeof message.from.length === "number" || $util.isString(message.from)))
                return "from: buffer expected";
        if (message.data != null && message.hasOwnProperty("data"))
            if (!(message.data && typeof message.data.length === "number" || $util.isString(message.data)))
                return "data: buffer expected";
        if (message.seqno != null && message.hasOwnProperty("seqno"))
            if (!(message.seqno && typeof message.seqno.length === "number" || $util.isString(message.seqno)))
                return "seqno: buffer expected";
        if (message.topic != null && message.hasOwnProperty("topic"))
            if (!$util.isString(message.topic))
                return "topic: string expected";
        if (message.signature != null && message.hasOwnProperty("signature"))
            if (!(message.signature && typeof message.signature.length === "number" || $util.isString(message.signature)))
                return "signature: buffer expected";
        if (message.key != null && message.hasOwnProperty("key"))
            if (!(message.key && typeof message.key.length === "number" || $util.isString(message.key)))
                return "key: buffer expected";
        return null;
    };

    /**
     * Creates a SignedDiscoveryRecord message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof SignedDiscoveryRecord
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {SignedDiscoveryRecord} SignedDiscoveryRecord
     */
    SignedDiscoveryRecord.fromObject = function fromObject(object) {
        if (object instanceof $root.SignedDiscoveryRecord)
            return object;
        var message = new $root.SignedDiscoveryRecord();
        if (object.from != null)
            if (typeof object.from === "string")
                $util.base64.decode(object.from, message.from = $util.newBuffer($util.base64.length(object.from)), 0);
            else if (object.from.length >= 0)
                message.from = object.from;
        if (object.data != null)
            if (typeof object.data === "string")
                $util.base64.decode(object.data, message.data = $util.newBuffer($util.base64.length(object.data)), 0);
            else if (object.data.length >= 0)
                message.data = object.data;
        if (object.seqno != null)
            if (typeof object.seqno === "string")
                $util.base64.decode(object.seqno, message.seqno = $util.newBuffer($util.base64.length(object.seqno)), 0);
            else if (object.seqno.length >= 0)
                message.seqno = object.seqno;
        if (object.topic != null)
            message.topic = String(object.topic);
        if (object.signature != null)
            if (typeof object.signature === "string")
                $util.base64.decode(object.signature, message.signature = $util.newBuffer($util.base64.length(object.signature)), 0);
            else if (object.signature.length >= 0)
                message.signature = object.signature;
        if (object.key != null)
            if (typeof object.key === "string")
                $util.base64.decode(object.key, message.key = $util.newBuffer($util.base64.length(object.key)), 0);
            else if (object.key.length >= 0)
                message.key = object.key;
        return message;
    };

    /**
     * Creates a plain object from a SignedDiscoveryRecord message. Also converts values to other types if specified.
     * @function toObject
     * @memberof SignedDiscoveryRecord
     * @static
     * @param {SignedDiscoveryRecord} message SignedDiscoveryRecord
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SignedDiscoveryRecord.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            if (options.bytes === String)
                object.from = "";
            else {
                object.from = [];
                if (options.bytes !== Array)
                    object.from = $util.newBuffer(object.from);
            }
            if (options.bytes === String)
                object.data = "";
            else {
                object.data = [];
                if (options.bytes !== Array)
                    object.data = $util.newBuffer(object.data);
            }
            if (options.bytes === String)
                object.seqno = "";
            else {
                object.seqno = [];
                if (options.bytes !== Array)
                    object.seqno = $util.newBuffer(object.seqno);
            }
            object.topic = "";
            if (options.bytes === String)
                object.signature = "";
            else {
                object.signature = [];
                if (options.bytes !== Array)
                    object.signature = $util.newBuffer(object.signature);
            }
            if (options.bytes === String)
                object.key = "";
            else {
                object.key = [];
                if (options.bytes !== Array)
                    object.key = $util.newBuffer(object.key);
            }
        }
        if (message.from != null && message.hasOwnProperty("from"))
            object.from = options.bytes === String ? $util.base64.encode(message.from, 0, message.from.length) : options.bytes === Array ? Array.prototype.slice.call(message.from) : message.from;
        if (message.data != null && message.hasOwnProperty("data"))
            object.data = options.bytes === String ? $util.base64.encode(message.data, 0, message.data.length) : options.bytes === Array ? Array.prototype.slice.call(message.data) : message.data;
        if (message.seqno != null && message.hasOwnProperty("seqno"))
            object.seqno = options.bytes === String ? $util.base64.encode(message.seqno, 0, message.seqno.length) : options.bytes === Array ? Array.prototype.slice.call(message.seqno) : message.seqno;
        if (message.topic != null && message.hasOwnProperty("topic"))
            object.topic = message.topic;
        if (message.signature != null && message.hasOwnProperty("signature"))
            object.signature = options.bytes === String ? $util.base64.encode(message.signature, 0, message.signature.length) : options.bytes === Array ? Array.prototype.slice.call(message.signature) : message.signature;
        if (message.key != null && message.hasOwnProperty("key"))
            object.key = options.bytes === String ? $util.base64.encode(message.key, 0, message.key.length) : options.bytes === Array ? Array.prototype.slice.call(message.key) : message.key;
        return object;
    };

    /**
     * Converts this SignedDiscoveryRecord to JSON.
     * @function toJSON
     * @memberof SignedDiscoveryRecord
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SignedDiscoveryRecord.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SignedDiscoveryRecord
     * @function getTypeUrl
     * @memberof SignedDiscoveryRecord
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SignedDiscoveryRecord.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/SignedDiscoveryRecord";
    };

    return SignedDiscoveryRecord;
})();

$root.FetchPeersResponse = (function() {

    /**
     * Properties of a FetchPeersResponse.
     * @exports IFetchPeersResponse
     * @interface IFetchPeersResponse
     * @property {Array.<ISignedDiscoveryRecord>|null} [records] FetchPeersResponse records
     */

    /**
     * Constructs a new FetchPeersResponse.
     * @exports FetchPeersResponse
     * @classdesc Represents a FetchPeersResponse.
     * @implements IFetchPeersResponse
     * @constructor
     * @param {IFetchPeersResponse=} [properties] Properties to set
     */
    function FetchPeersResponse(properties) {
        this.records = [];
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * FetchPeersResponse records.
     * @member {Array.<ISignedDiscoveryRecord>} records
     * @memberof FetchPeersResponse
     * @instance
     */
    FetchPeersResponse.prototype.records = $util.emptyArray;

    /**
     * Creates a new FetchPeersResponse instance using the specified properties.
     * @function create
     * @memberof FetchPeersResponse
     * @static
     * @param {IFetchPeersResponse=} [properties] Properties to set
     * @returns {FetchPeersResponse} FetchPeersResponse instance
     */
    FetchPeersResponse.create = function create(properties) {
        return new FetchPeersResponse(properties);
    };

    /**
     * Encodes the specified FetchPeersResponse message. Does not implicitly {@link FetchPeersResponse.verify|verify} messages.
     * @function encode
     * @memberof FetchPeersResponse
     * @static
     * @param {IFetchPeersResponse} message FetchPeersResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FetchPeersResponse.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.records != null && message.records.length)
            for (var i = 0; i < message.records.length; ++i)
                $root.SignedDiscoveryRecord.encode(message.records[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified FetchPeersResponse message, length delimited. Does not implicitly {@link FetchPeersResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof FetchPeersResponse
     * @static
     * @param {IFetchPeersResponse} message FetchPeersResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FetchPeersResponse.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a FetchPeersResponse message from the specified reader or buffer.
     * @function decode
     * @memberof FetchPeersResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {FetchPeersResponse} FetchPeersResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FetchPeersResponse.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.FetchPeersResponse();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    if (!(message.records && message.records.length))
                        message.records = [];
                    message.records.push($root.SignedDiscoveryRecord.decode(reader, reader.uint32()));
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
     * Decodes a FetchPeersResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof FetchPeersResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {FetchPeersResponse} FetchPeersResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FetchPeersResponse.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a FetchPeersResponse message.
     * @function verify
     * @memberof FetchPeersResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    FetchPeersResponse.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.records != null && message.hasOwnProperty("records")) {
            if (!Array.isArray(message.records))
                return "records: array expected";
            for (var i = 0; i < message.records.length; ++i) {
                var error = $root.SignedDiscoveryRecord.verify(message.records[i]);
                if (error)
                    return "records." + error;
            }
        }
        return null;
    };

    /**
     * Creates a FetchPeersResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof FetchPeersResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {FetchPeersResponse} FetchPeersResponse
     */
    FetchPeersResponse.fromObject = function fromObject(object) {
        if (object instanceof $root.FetchPeersResponse)
            return object;
        var message = new $root.FetchPeersResponse();
        if (object.records) {
            if (!Array.isArray(object.records))
                throw TypeError(".FetchPeersResponse.records: array expected");
            message.records = [];
            for (var i = 0; i < object.records.length; ++i) {
                if (typeof object.records[i] !== "object")
                    throw TypeError(".FetchPeersResponse.records: object expected");
                message.records[i] = $root.SignedDiscoveryRecord.fromObject(object.records[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a FetchPeersResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof FetchPeersResponse
     * @static
     * @param {FetchPeersResponse} message FetchPeersResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    FetchPeersResponse.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.arrays || options.defaults)
            object.records = [];
        if (message.records && message.records.length) {
            object.records = [];
            for (var j = 0; j < message.records.length; ++j)
                object.records[j] = $root.SignedDiscoveryRecord.toObject(message.records[j], options);
        }
        return object;
    };

    /**
     * Converts this FetchPeersResponse to JSON.
     * @function toJSON
     * @memberof FetchPeersResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    FetchPeersResponse.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for FetchPeersResponse
     * @function getTypeUrl
     * @memberof FetchPeersResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    FetchPeersResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/FetchPeersResponse";
    };

    return FetchPeersResponse;
})();

module.exports = $root;
