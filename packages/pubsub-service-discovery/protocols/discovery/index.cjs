/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.Record = (function() {

    /**
     * Properties of a Record.
     * @exports IRecord
     * @interface IRecord
     * @property {Array.<Uint8Array>|null} [addrs] Record addrs
     * @property {Array.<string>|null} [protocols] Record protocols
     */

    /**
     * Constructs a new Record.
     * @exports Record
     * @classdesc Represents a Record.
     * @implements IRecord
     * @constructor
     * @param {IRecord=} [properties] Properties to set
     */
    function Record(properties) {
        this.addrs = [];
        this.protocols = [];
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Record addrs.
     * @member {Array.<Uint8Array>} addrs
     * @memberof Record
     * @instance
     */
    Record.prototype.addrs = $util.emptyArray;

    /**
     * Record protocols.
     * @member {Array.<string>} protocols
     * @memberof Record
     * @instance
     */
    Record.prototype.protocols = $util.emptyArray;

    /**
     * Creates a new Record instance using the specified properties.
     * @function create
     * @memberof Record
     * @static
     * @param {IRecord=} [properties] Properties to set
     * @returns {Record} Record instance
     */
    Record.create = function create(properties) {
        return new Record(properties);
    };

    /**
     * Encodes the specified Record message. Does not implicitly {@link Record.verify|verify} messages.
     * @function encode
     * @memberof Record
     * @static
     * @param {IRecord} message Record message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Record.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.addrs != null && message.addrs.length)
            for (var i = 0; i < message.addrs.length; ++i)
                writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.addrs[i]);
        if (message.protocols != null && message.protocols.length)
            for (var i = 0; i < message.protocols.length; ++i)
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.protocols[i]);
        return writer;
    };

    /**
     * Encodes the specified Record message, length delimited. Does not implicitly {@link Record.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Record
     * @static
     * @param {IRecord} message Record message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Record.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Record message from the specified reader or buffer.
     * @function decode
     * @memberof Record
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Record} Record
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Record.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Record();
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
                    if (!(message.protocols && message.protocols.length))
                        message.protocols = [];
                    message.protocols.push(reader.string());
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
     * Decodes a Record message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Record
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Record} Record
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Record.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Record message.
     * @function verify
     * @memberof Record
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Record.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.addrs != null && message.hasOwnProperty("addrs")) {
            if (!Array.isArray(message.addrs))
                return "addrs: array expected";
            for (var i = 0; i < message.addrs.length; ++i)
                if (!(message.addrs[i] && typeof message.addrs[i].length === "number" || $util.isString(message.addrs[i])))
                    return "addrs: buffer[] expected";
        }
        if (message.protocols != null && message.hasOwnProperty("protocols")) {
            if (!Array.isArray(message.protocols))
                return "protocols: array expected";
            for (var i = 0; i < message.protocols.length; ++i)
                if (!$util.isString(message.protocols[i]))
                    return "protocols: string[] expected";
        }
        return null;
    };

    /**
     * Creates a Record message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Record
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Record} Record
     */
    Record.fromObject = function fromObject(object) {
        if (object instanceof $root.Record)
            return object;
        var message = new $root.Record();
        if (object.addrs) {
            if (!Array.isArray(object.addrs))
                throw TypeError(".Record.addrs: array expected");
            message.addrs = [];
            for (var i = 0; i < object.addrs.length; ++i)
                if (typeof object.addrs[i] === "string")
                    $util.base64.decode(object.addrs[i], message.addrs[i] = $util.newBuffer($util.base64.length(object.addrs[i])), 0);
                else if (object.addrs[i].length >= 0)
                    message.addrs[i] = object.addrs[i];
        }
        if (object.protocols) {
            if (!Array.isArray(object.protocols))
                throw TypeError(".Record.protocols: array expected");
            message.protocols = [];
            for (var i = 0; i < object.protocols.length; ++i)
                message.protocols[i] = String(object.protocols[i]);
        }
        return message;
    };

    /**
     * Creates a plain object from a Record message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Record
     * @static
     * @param {Record} message Record
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Record.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.arrays || options.defaults) {
            object.addrs = [];
            object.protocols = [];
        }
        if (message.addrs && message.addrs.length) {
            object.addrs = [];
            for (var j = 0; j < message.addrs.length; ++j)
                object.addrs[j] = options.bytes === String ? $util.base64.encode(message.addrs[j], 0, message.addrs[j].length) : options.bytes === Array ? Array.prototype.slice.call(message.addrs[j]) : message.addrs[j];
        }
        if (message.protocols && message.protocols.length) {
            object.protocols = [];
            for (var j = 0; j < message.protocols.length; ++j)
                object.protocols[j] = message.protocols[j];
        }
        return object;
    };

    /**
     * Converts this Record to JSON.
     * @function toJSON
     * @memberof Record
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Record.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Record
     * @function getTypeUrl
     * @memberof Record
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Record.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/Record";
    };

    return Record;
})();

$root.SignedRecord = (function() {

    /**
     * Properties of a SignedRecord.
     * @exports ISignedRecord
     * @interface ISignedRecord
     * @property {Uint8Array|null} [from] SignedRecord from
     * @property {Uint8Array|null} [data] SignedRecord data
     * @property {Uint8Array|null} [seqno] SignedRecord seqno
     * @property {string|null} [topic] SignedRecord topic
     * @property {Uint8Array|null} [signature] SignedRecord signature
     * @property {Uint8Array|null} [key] SignedRecord key
     */

    /**
     * Constructs a new SignedRecord.
     * @exports SignedRecord
     * @classdesc Represents a SignedRecord.
     * @implements ISignedRecord
     * @constructor
     * @param {ISignedRecord=} [properties] Properties to set
     */
    function SignedRecord(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * SignedRecord from.
     * @member {Uint8Array} from
     * @memberof SignedRecord
     * @instance
     */
    SignedRecord.prototype.from = $util.newBuffer([]);

    /**
     * SignedRecord data.
     * @member {Uint8Array} data
     * @memberof SignedRecord
     * @instance
     */
    SignedRecord.prototype.data = $util.newBuffer([]);

    /**
     * SignedRecord seqno.
     * @member {Uint8Array} seqno
     * @memberof SignedRecord
     * @instance
     */
    SignedRecord.prototype.seqno = $util.newBuffer([]);

    /**
     * SignedRecord topic.
     * @member {string} topic
     * @memberof SignedRecord
     * @instance
     */
    SignedRecord.prototype.topic = "";

    /**
     * SignedRecord signature.
     * @member {Uint8Array} signature
     * @memberof SignedRecord
     * @instance
     */
    SignedRecord.prototype.signature = $util.newBuffer([]);

    /**
     * SignedRecord key.
     * @member {Uint8Array} key
     * @memberof SignedRecord
     * @instance
     */
    SignedRecord.prototype.key = $util.newBuffer([]);

    /**
     * Creates a new SignedRecord instance using the specified properties.
     * @function create
     * @memberof SignedRecord
     * @static
     * @param {ISignedRecord=} [properties] Properties to set
     * @returns {SignedRecord} SignedRecord instance
     */
    SignedRecord.create = function create(properties) {
        return new SignedRecord(properties);
    };

    /**
     * Encodes the specified SignedRecord message. Does not implicitly {@link SignedRecord.verify|verify} messages.
     * @function encode
     * @memberof SignedRecord
     * @static
     * @param {ISignedRecord} message SignedRecord message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SignedRecord.encode = function encode(message, writer) {
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
     * Encodes the specified SignedRecord message, length delimited. Does not implicitly {@link SignedRecord.verify|verify} messages.
     * @function encodeDelimited
     * @memberof SignedRecord
     * @static
     * @param {ISignedRecord} message SignedRecord message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SignedRecord.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SignedRecord message from the specified reader or buffer.
     * @function decode
     * @memberof SignedRecord
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {SignedRecord} SignedRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SignedRecord.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.SignedRecord();
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
     * Decodes a SignedRecord message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof SignedRecord
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {SignedRecord} SignedRecord
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SignedRecord.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SignedRecord message.
     * @function verify
     * @memberof SignedRecord
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SignedRecord.verify = function verify(message) {
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
     * Creates a SignedRecord message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof SignedRecord
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {SignedRecord} SignedRecord
     */
    SignedRecord.fromObject = function fromObject(object) {
        if (object instanceof $root.SignedRecord)
            return object;
        var message = new $root.SignedRecord();
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
     * Creates a plain object from a SignedRecord message. Also converts values to other types if specified.
     * @function toObject
     * @memberof SignedRecord
     * @static
     * @param {SignedRecord} message SignedRecord
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SignedRecord.toObject = function toObject(message, options) {
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
     * Converts this SignedRecord to JSON.
     * @function toJSON
     * @memberof SignedRecord
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SignedRecord.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SignedRecord
     * @function getTypeUrl
     * @memberof SignedRecord
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SignedRecord.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/SignedRecord";
    };

    return SignedRecord;
})();

$root.QueryRequest = (function() {

    /**
     * Properties of a QueryRequest.
     * @exports IQueryRequest
     * @interface IQueryRequest
     * @property {string|null} [protocol] QueryRequest protocol
     * @property {number|null} [limit] QueryRequest limit
     */

    /**
     * Constructs a new QueryRequest.
     * @exports QueryRequest
     * @classdesc Represents a QueryRequest.
     * @implements IQueryRequest
     * @constructor
     * @param {IQueryRequest=} [properties] Properties to set
     */
    function QueryRequest(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * QueryRequest protocol.
     * @member {string} protocol
     * @memberof QueryRequest
     * @instance
     */
    QueryRequest.prototype.protocol = "";

    /**
     * QueryRequest limit.
     * @member {number} limit
     * @memberof QueryRequest
     * @instance
     */
    QueryRequest.prototype.limit = 0;

    /**
     * Creates a new QueryRequest instance using the specified properties.
     * @function create
     * @memberof QueryRequest
     * @static
     * @param {IQueryRequest=} [properties] Properties to set
     * @returns {QueryRequest} QueryRequest instance
     */
    QueryRequest.create = function create(properties) {
        return new QueryRequest(properties);
    };

    /**
     * Encodes the specified QueryRequest message. Does not implicitly {@link QueryRequest.verify|verify} messages.
     * @function encode
     * @memberof QueryRequest
     * @static
     * @param {IQueryRequest} message QueryRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    QueryRequest.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.protocol != null && Object.hasOwnProperty.call(message, "protocol"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.protocol);
        if (message.limit != null && Object.hasOwnProperty.call(message, "limit"))
            writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.limit);
        return writer;
    };

    /**
     * Encodes the specified QueryRequest message, length delimited. Does not implicitly {@link QueryRequest.verify|verify} messages.
     * @function encodeDelimited
     * @memberof QueryRequest
     * @static
     * @param {IQueryRequest} message QueryRequest message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    QueryRequest.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a QueryRequest message from the specified reader or buffer.
     * @function decode
     * @memberof QueryRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {QueryRequest} QueryRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    QueryRequest.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.QueryRequest();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.protocol = reader.string();
                    break;
                }
            case 2: {
                    message.limit = reader.uint32();
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
     * Decodes a QueryRequest message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof QueryRequest
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {QueryRequest} QueryRequest
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    QueryRequest.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a QueryRequest message.
     * @function verify
     * @memberof QueryRequest
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    QueryRequest.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.protocol != null && message.hasOwnProperty("protocol"))
            if (!$util.isString(message.protocol))
                return "protocol: string expected";
        if (message.limit != null && message.hasOwnProperty("limit"))
            if (!$util.isInteger(message.limit))
                return "limit: integer expected";
        return null;
    };

    /**
     * Creates a QueryRequest message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof QueryRequest
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {QueryRequest} QueryRequest
     */
    QueryRequest.fromObject = function fromObject(object) {
        if (object instanceof $root.QueryRequest)
            return object;
        var message = new $root.QueryRequest();
        if (object.protocol != null)
            message.protocol = String(object.protocol);
        if (object.limit != null)
            message.limit = object.limit >>> 0;
        return message;
    };

    /**
     * Creates a plain object from a QueryRequest message. Also converts values to other types if specified.
     * @function toObject
     * @memberof QueryRequest
     * @static
     * @param {QueryRequest} message QueryRequest
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    QueryRequest.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.protocol = "";
            object.limit = 0;
        }
        if (message.protocol != null && message.hasOwnProperty("protocol"))
            object.protocol = message.protocol;
        if (message.limit != null && message.hasOwnProperty("limit"))
            object.limit = message.limit;
        return object;
    };

    /**
     * Converts this QueryRequest to JSON.
     * @function toJSON
     * @memberof QueryRequest
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    QueryRequest.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for QueryRequest
     * @function getTypeUrl
     * @memberof QueryRequest
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    QueryRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/QueryRequest";
    };

    return QueryRequest;
})();

$root.QueryResponse = (function() {

    /**
     * Properties of a QueryResponse.
     * @exports IQueryResponse
     * @interface IQueryResponse
     * @property {Array.<ISignedRecord>|null} [records] QueryResponse records
     */

    /**
     * Constructs a new QueryResponse.
     * @exports QueryResponse
     * @classdesc Represents a QueryResponse.
     * @implements IQueryResponse
     * @constructor
     * @param {IQueryResponse=} [properties] Properties to set
     */
    function QueryResponse(properties) {
        this.records = [];
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * QueryResponse records.
     * @member {Array.<ISignedRecord>} records
     * @memberof QueryResponse
     * @instance
     */
    QueryResponse.prototype.records = $util.emptyArray;

    /**
     * Creates a new QueryResponse instance using the specified properties.
     * @function create
     * @memberof QueryResponse
     * @static
     * @param {IQueryResponse=} [properties] Properties to set
     * @returns {QueryResponse} QueryResponse instance
     */
    QueryResponse.create = function create(properties) {
        return new QueryResponse(properties);
    };

    /**
     * Encodes the specified QueryResponse message. Does not implicitly {@link QueryResponse.verify|verify} messages.
     * @function encode
     * @memberof QueryResponse
     * @static
     * @param {IQueryResponse} message QueryResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    QueryResponse.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.records != null && message.records.length)
            for (var i = 0; i < message.records.length; ++i)
                $root.SignedRecord.encode(message.records[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified QueryResponse message, length delimited. Does not implicitly {@link QueryResponse.verify|verify} messages.
     * @function encodeDelimited
     * @memberof QueryResponse
     * @static
     * @param {IQueryResponse} message QueryResponse message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    QueryResponse.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a QueryResponse message from the specified reader or buffer.
     * @function decode
     * @memberof QueryResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {QueryResponse} QueryResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    QueryResponse.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.QueryResponse();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    if (!(message.records && message.records.length))
                        message.records = [];
                    message.records.push($root.SignedRecord.decode(reader, reader.uint32()));
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
     * Decodes a QueryResponse message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof QueryResponse
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {QueryResponse} QueryResponse
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    QueryResponse.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a QueryResponse message.
     * @function verify
     * @memberof QueryResponse
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    QueryResponse.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.records != null && message.hasOwnProperty("records")) {
            if (!Array.isArray(message.records))
                return "records: array expected";
            for (var i = 0; i < message.records.length; ++i) {
                var error = $root.SignedRecord.verify(message.records[i]);
                if (error)
                    return "records." + error;
            }
        }
        return null;
    };

    /**
     * Creates a QueryResponse message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof QueryResponse
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {QueryResponse} QueryResponse
     */
    QueryResponse.fromObject = function fromObject(object) {
        if (object instanceof $root.QueryResponse)
            return object;
        var message = new $root.QueryResponse();
        if (object.records) {
            if (!Array.isArray(object.records))
                throw TypeError(".QueryResponse.records: array expected");
            message.records = [];
            for (var i = 0; i < object.records.length; ++i) {
                if (typeof object.records[i] !== "object")
                    throw TypeError(".QueryResponse.records: object expected");
                message.records[i] = $root.SignedRecord.fromObject(object.records[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a QueryResponse message. Also converts values to other types if specified.
     * @function toObject
     * @memberof QueryResponse
     * @static
     * @param {QueryResponse} message QueryResponse
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    QueryResponse.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.arrays || options.defaults)
            object.records = [];
        if (message.records && message.records.length) {
            object.records = [];
            for (var j = 0; j < message.records.length; ++j)
                object.records[j] = $root.SignedRecord.toObject(message.records[j], options);
        }
        return object;
    };

    /**
     * Converts this QueryResponse to JSON.
     * @function toJSON
     * @memberof QueryResponse
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    QueryResponse.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for QueryResponse
     * @function getTypeUrl
     * @memberof QueryResponse
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    QueryResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/QueryResponse";
    };

    return QueryResponse;
})();

module.exports = $root;
