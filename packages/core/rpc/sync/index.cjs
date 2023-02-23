/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.Node = (function() {

    /**
     * Properties of a Node.
     * @exports INode
     * @interface INode
     * @property {number|null} [level] Node level
     * @property {Uint8Array|null} [key] Node key
     * @property {Uint8Array|null} [hash] Node hash
     * @property {Uint8Array|null} [value] Node value
     */

    /**
     * Constructs a new Node.
     * @exports Node
     * @classdesc Represents a Node.
     * @implements INode
     * @constructor
     * @param {INode=} [properties] Properties to set
     */
    function Node(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Node level.
     * @member {number} level
     * @memberof Node
     * @instance
     */
    Node.prototype.level = 0;

    /**
     * Node key.
     * @member {Uint8Array} key
     * @memberof Node
     * @instance
     */
    Node.prototype.key = $util.newBuffer([]);

    /**
     * Node hash.
     * @member {Uint8Array} hash
     * @memberof Node
     * @instance
     */
    Node.prototype.hash = $util.newBuffer([]);

    /**
     * Node value.
     * @member {Uint8Array|null|undefined} value
     * @memberof Node
     * @instance
     */
    Node.prototype.value = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * Node _value.
     * @member {"value"|undefined} _value
     * @memberof Node
     * @instance
     */
    Object.defineProperty(Node.prototype, "_value", {
        get: $util.oneOfGetter($oneOfFields = ["value"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * Creates a new Node instance using the specified properties.
     * @function create
     * @memberof Node
     * @static
     * @param {INode=} [properties] Properties to set
     * @returns {Node} Node instance
     */
    Node.create = function create(properties) {
        return new Node(properties);
    };

    /**
     * Encodes the specified Node message. Does not implicitly {@link Node.verify|verify} messages.
     * @function encode
     * @memberof Node
     * @static
     * @param {INode} message Node message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Node.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.level != null && Object.hasOwnProperty.call(message, "level"))
            writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.level);
        if (message.key != null && Object.hasOwnProperty.call(message, "key"))
            writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.key);
        if (message.hash != null && Object.hasOwnProperty.call(message, "hash"))
            writer.uint32(/* id 3, wireType 2 =*/26).bytes(message.hash);
        if (message.value != null && Object.hasOwnProperty.call(message, "value"))
            writer.uint32(/* id 4, wireType 2 =*/34).bytes(message.value);
        return writer;
    };

    /**
     * Encodes the specified Node message, length delimited. Does not implicitly {@link Node.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Node
     * @static
     * @param {INode} message Node message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Node.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Node message from the specified reader or buffer.
     * @function decode
     * @memberof Node
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Node} Node
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Node.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Node();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.level = reader.uint32();
                    break;
                }
            case 2: {
                    message.key = reader.bytes();
                    break;
                }
            case 3: {
                    message.hash = reader.bytes();
                    break;
                }
            case 4: {
                    message.value = reader.bytes();
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
     * Decodes a Node message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Node
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Node} Node
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Node.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Node message.
     * @function verify
     * @memberof Node
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Node.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        var properties = {};
        if (message.level != null && message.hasOwnProperty("level"))
            if (!$util.isInteger(message.level))
                return "level: integer expected";
        if (message.key != null && message.hasOwnProperty("key"))
            if (!(message.key && typeof message.key.length === "number" || $util.isString(message.key)))
                return "key: buffer expected";
        if (message.hash != null && message.hasOwnProperty("hash"))
            if (!(message.hash && typeof message.hash.length === "number" || $util.isString(message.hash)))
                return "hash: buffer expected";
        if (message.value != null && message.hasOwnProperty("value")) {
            properties._value = 1;
            if (!(message.value && typeof message.value.length === "number" || $util.isString(message.value)))
                return "value: buffer expected";
        }
        return null;
    };

    /**
     * Creates a Node message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Node
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Node} Node
     */
    Node.fromObject = function fromObject(object) {
        if (object instanceof $root.Node)
            return object;
        var message = new $root.Node();
        if (object.level != null)
            message.level = object.level >>> 0;
        if (object.key != null)
            if (typeof object.key === "string")
                $util.base64.decode(object.key, message.key = $util.newBuffer($util.base64.length(object.key)), 0);
            else if (object.key.length >= 0)
                message.key = object.key;
        if (object.hash != null)
            if (typeof object.hash === "string")
                $util.base64.decode(object.hash, message.hash = $util.newBuffer($util.base64.length(object.hash)), 0);
            else if (object.hash.length >= 0)
                message.hash = object.hash;
        if (object.value != null)
            if (typeof object.value === "string")
                $util.base64.decode(object.value, message.value = $util.newBuffer($util.base64.length(object.value)), 0);
            else if (object.value.length >= 0)
                message.value = object.value;
        return message;
    };

    /**
     * Creates a plain object from a Node message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Node
     * @static
     * @param {Node} message Node
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Node.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.level = 0;
            if (options.bytes === String)
                object.key = "";
            else {
                object.key = [];
                if (options.bytes !== Array)
                    object.key = $util.newBuffer(object.key);
            }
            if (options.bytes === String)
                object.hash = "";
            else {
                object.hash = [];
                if (options.bytes !== Array)
                    object.hash = $util.newBuffer(object.hash);
            }
        }
        if (message.level != null && message.hasOwnProperty("level"))
            object.level = message.level;
        if (message.key != null && message.hasOwnProperty("key"))
            object.key = options.bytes === String ? $util.base64.encode(message.key, 0, message.key.length) : options.bytes === Array ? Array.prototype.slice.call(message.key) : message.key;
        if (message.hash != null && message.hasOwnProperty("hash"))
            object.hash = options.bytes === String ? $util.base64.encode(message.hash, 0, message.hash.length) : options.bytes === Array ? Array.prototype.slice.call(message.hash) : message.hash;
        if (message.value != null && message.hasOwnProperty("value")) {
            object.value = options.bytes === String ? $util.base64.encode(message.value, 0, message.value.length) : options.bytes === Array ? Array.prototype.slice.call(message.value) : message.value;
            if (options.oneofs)
                object._value = "value";
        }
        return object;
    };

    /**
     * Converts this Node to JSON.
     * @function toJSON
     * @memberof Node
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Node.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Node
     * @function getTypeUrl
     * @memberof Node
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Node.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/Node";
    };

    return Node;
})();

$root.Request = (function() {

    /**
     * Properties of a Request.
     * @exports IRequest
     * @interface IRequest
     * @property {number|null} [seq] Request seq
     * @property {Request.IGetRootRequest|null} [getRoot] Request getRoot
     * @property {Request.IGetChildrenRequest|null} [getChildren] Request getChildren
     * @property {Request.IGetMessagesRequest|null} [getMessages] Request getMessages
     */

    /**
     * Constructs a new Request.
     * @exports Request
     * @classdesc Represents a Request.
     * @implements IRequest
     * @constructor
     * @param {IRequest=} [properties] Properties to set
     */
    function Request(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Request seq.
     * @member {number} seq
     * @memberof Request
     * @instance
     */
    Request.prototype.seq = 0;

    /**
     * Request getRoot.
     * @member {Request.IGetRootRequest|null|undefined} getRoot
     * @memberof Request
     * @instance
     */
    Request.prototype.getRoot = null;

    /**
     * Request getChildren.
     * @member {Request.IGetChildrenRequest|null|undefined} getChildren
     * @memberof Request
     * @instance
     */
    Request.prototype.getChildren = null;

    /**
     * Request getMessages.
     * @member {Request.IGetMessagesRequest|null|undefined} getMessages
     * @memberof Request
     * @instance
     */
    Request.prototype.getMessages = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * Request request.
     * @member {"getRoot"|"getChildren"|"getMessages"|undefined} request
     * @memberof Request
     * @instance
     */
    Object.defineProperty(Request.prototype, "request", {
        get: $util.oneOfGetter($oneOfFields = ["getRoot", "getChildren", "getMessages"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * Creates a new Request instance using the specified properties.
     * @function create
     * @memberof Request
     * @static
     * @param {IRequest=} [properties] Properties to set
     * @returns {Request} Request instance
     */
    Request.create = function create(properties) {
        return new Request(properties);
    };

    /**
     * Encodes the specified Request message. Does not implicitly {@link Request.verify|verify} messages.
     * @function encode
     * @memberof Request
     * @static
     * @param {IRequest} message Request message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Request.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.seq != null && Object.hasOwnProperty.call(message, "seq"))
            writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.seq);
        if (message.getRoot != null && Object.hasOwnProperty.call(message, "getRoot"))
            $root.Request.GetRootRequest.encode(message.getRoot, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.getChildren != null && Object.hasOwnProperty.call(message, "getChildren"))
            $root.Request.GetChildrenRequest.encode(message.getChildren, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        if (message.getMessages != null && Object.hasOwnProperty.call(message, "getMessages"))
            $root.Request.GetMessagesRequest.encode(message.getMessages, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified Request message, length delimited. Does not implicitly {@link Request.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Request
     * @static
     * @param {IRequest} message Request message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Request.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Request message from the specified reader or buffer.
     * @function decode
     * @memberof Request
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Request} Request
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Request.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Request();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.seq = reader.uint32();
                    break;
                }
            case 2: {
                    message.getRoot = $root.Request.GetRootRequest.decode(reader, reader.uint32());
                    break;
                }
            case 3: {
                    message.getChildren = $root.Request.GetChildrenRequest.decode(reader, reader.uint32());
                    break;
                }
            case 4: {
                    message.getMessages = $root.Request.GetMessagesRequest.decode(reader, reader.uint32());
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
     * Decodes a Request message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Request
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Request} Request
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Request.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Request message.
     * @function verify
     * @memberof Request
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Request.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        var properties = {};
        if (message.seq != null && message.hasOwnProperty("seq"))
            if (!$util.isInteger(message.seq))
                return "seq: integer expected";
        if (message.getRoot != null && message.hasOwnProperty("getRoot")) {
            properties.request = 1;
            {
                var error = $root.Request.GetRootRequest.verify(message.getRoot);
                if (error)
                    return "getRoot." + error;
            }
        }
        if (message.getChildren != null && message.hasOwnProperty("getChildren")) {
            if (properties.request === 1)
                return "request: multiple values";
            properties.request = 1;
            {
                var error = $root.Request.GetChildrenRequest.verify(message.getChildren);
                if (error)
                    return "getChildren." + error;
            }
        }
        if (message.getMessages != null && message.hasOwnProperty("getMessages")) {
            if (properties.request === 1)
                return "request: multiple values";
            properties.request = 1;
            {
                var error = $root.Request.GetMessagesRequest.verify(message.getMessages);
                if (error)
                    return "getMessages." + error;
            }
        }
        return null;
    };

    /**
     * Creates a Request message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Request
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Request} Request
     */
    Request.fromObject = function fromObject(object) {
        if (object instanceof $root.Request)
            return object;
        var message = new $root.Request();
        if (object.seq != null)
            message.seq = object.seq >>> 0;
        if (object.getRoot != null) {
            if (typeof object.getRoot !== "object")
                throw TypeError(".Request.getRoot: object expected");
            message.getRoot = $root.Request.GetRootRequest.fromObject(object.getRoot);
        }
        if (object.getChildren != null) {
            if (typeof object.getChildren !== "object")
                throw TypeError(".Request.getChildren: object expected");
            message.getChildren = $root.Request.GetChildrenRequest.fromObject(object.getChildren);
        }
        if (object.getMessages != null) {
            if (typeof object.getMessages !== "object")
                throw TypeError(".Request.getMessages: object expected");
            message.getMessages = $root.Request.GetMessagesRequest.fromObject(object.getMessages);
        }
        return message;
    };

    /**
     * Creates a plain object from a Request message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Request
     * @static
     * @param {Request} message Request
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Request.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults)
            object.seq = 0;
        if (message.seq != null && message.hasOwnProperty("seq"))
            object.seq = message.seq;
        if (message.getRoot != null && message.hasOwnProperty("getRoot")) {
            object.getRoot = $root.Request.GetRootRequest.toObject(message.getRoot, options);
            if (options.oneofs)
                object.request = "getRoot";
        }
        if (message.getChildren != null && message.hasOwnProperty("getChildren")) {
            object.getChildren = $root.Request.GetChildrenRequest.toObject(message.getChildren, options);
            if (options.oneofs)
                object.request = "getChildren";
        }
        if (message.getMessages != null && message.hasOwnProperty("getMessages")) {
            object.getMessages = $root.Request.GetMessagesRequest.toObject(message.getMessages, options);
            if (options.oneofs)
                object.request = "getMessages";
        }
        return object;
    };

    /**
     * Converts this Request to JSON.
     * @function toJSON
     * @memberof Request
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Request.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Request
     * @function getTypeUrl
     * @memberof Request
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Request.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/Request";
    };

    Request.GetRootRequest = (function() {

        /**
         * Properties of a GetRootRequest.
         * @memberof Request
         * @interface IGetRootRequest
         */

        /**
         * Constructs a new GetRootRequest.
         * @memberof Request
         * @classdesc Represents a GetRootRequest.
         * @implements IGetRootRequest
         * @constructor
         * @param {Request.IGetRootRequest=} [properties] Properties to set
         */
        function GetRootRequest(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Creates a new GetRootRequest instance using the specified properties.
         * @function create
         * @memberof Request.GetRootRequest
         * @static
         * @param {Request.IGetRootRequest=} [properties] Properties to set
         * @returns {Request.GetRootRequest} GetRootRequest instance
         */
        GetRootRequest.create = function create(properties) {
            return new GetRootRequest(properties);
        };

        /**
         * Encodes the specified GetRootRequest message. Does not implicitly {@link Request.GetRootRequest.verify|verify} messages.
         * @function encode
         * @memberof Request.GetRootRequest
         * @static
         * @param {Request.IGetRootRequest} message GetRootRequest message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GetRootRequest.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            return writer;
        };

        /**
         * Encodes the specified GetRootRequest message, length delimited. Does not implicitly {@link Request.GetRootRequest.verify|verify} messages.
         * @function encodeDelimited
         * @memberof Request.GetRootRequest
         * @static
         * @param {Request.IGetRootRequest} message GetRootRequest message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GetRootRequest.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a GetRootRequest message from the specified reader or buffer.
         * @function decode
         * @memberof Request.GetRootRequest
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {Request.GetRootRequest} GetRootRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GetRootRequest.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Request.GetRootRequest();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a GetRootRequest message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof Request.GetRootRequest
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {Request.GetRootRequest} GetRootRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GetRootRequest.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a GetRootRequest message.
         * @function verify
         * @memberof Request.GetRootRequest
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        GetRootRequest.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            return null;
        };

        /**
         * Creates a GetRootRequest message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof Request.GetRootRequest
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {Request.GetRootRequest} GetRootRequest
         */
        GetRootRequest.fromObject = function fromObject(object) {
            if (object instanceof $root.Request.GetRootRequest)
                return object;
            return new $root.Request.GetRootRequest();
        };

        /**
         * Creates a plain object from a GetRootRequest message. Also converts values to other types if specified.
         * @function toObject
         * @memberof Request.GetRootRequest
         * @static
         * @param {Request.GetRootRequest} message GetRootRequest
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        GetRootRequest.toObject = function toObject() {
            return {};
        };

        /**
         * Converts this GetRootRequest to JSON.
         * @function toJSON
         * @memberof Request.GetRootRequest
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        GetRootRequest.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for GetRootRequest
         * @function getTypeUrl
         * @memberof Request.GetRootRequest
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        GetRootRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/Request.GetRootRequest";
        };

        return GetRootRequest;
    })();

    Request.GetChildrenRequest = (function() {

        /**
         * Properties of a GetChildrenRequest.
         * @memberof Request
         * @interface IGetChildrenRequest
         * @property {number|null} [level] GetChildrenRequest level
         * @property {Uint8Array|null} [key] GetChildrenRequest key
         */

        /**
         * Constructs a new GetChildrenRequest.
         * @memberof Request
         * @classdesc Represents a GetChildrenRequest.
         * @implements IGetChildrenRequest
         * @constructor
         * @param {Request.IGetChildrenRequest=} [properties] Properties to set
         */
        function GetChildrenRequest(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * GetChildrenRequest level.
         * @member {number} level
         * @memberof Request.GetChildrenRequest
         * @instance
         */
        GetChildrenRequest.prototype.level = 0;

        /**
         * GetChildrenRequest key.
         * @member {Uint8Array} key
         * @memberof Request.GetChildrenRequest
         * @instance
         */
        GetChildrenRequest.prototype.key = $util.newBuffer([]);

        /**
         * Creates a new GetChildrenRequest instance using the specified properties.
         * @function create
         * @memberof Request.GetChildrenRequest
         * @static
         * @param {Request.IGetChildrenRequest=} [properties] Properties to set
         * @returns {Request.GetChildrenRequest} GetChildrenRequest instance
         */
        GetChildrenRequest.create = function create(properties) {
            return new GetChildrenRequest(properties);
        };

        /**
         * Encodes the specified GetChildrenRequest message. Does not implicitly {@link Request.GetChildrenRequest.verify|verify} messages.
         * @function encode
         * @memberof Request.GetChildrenRequest
         * @static
         * @param {Request.IGetChildrenRequest} message GetChildrenRequest message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GetChildrenRequest.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.level != null && Object.hasOwnProperty.call(message, "level"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.level);
            if (message.key != null && Object.hasOwnProperty.call(message, "key"))
                writer.uint32(/* id 3, wireType 2 =*/26).bytes(message.key);
            return writer;
        };

        /**
         * Encodes the specified GetChildrenRequest message, length delimited. Does not implicitly {@link Request.GetChildrenRequest.verify|verify} messages.
         * @function encodeDelimited
         * @memberof Request.GetChildrenRequest
         * @static
         * @param {Request.IGetChildrenRequest} message GetChildrenRequest message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GetChildrenRequest.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a GetChildrenRequest message from the specified reader or buffer.
         * @function decode
         * @memberof Request.GetChildrenRequest
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {Request.GetChildrenRequest} GetChildrenRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GetChildrenRequest.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Request.GetChildrenRequest();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 2: {
                        message.level = reader.uint32();
                        break;
                    }
                case 3: {
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
         * Decodes a GetChildrenRequest message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof Request.GetChildrenRequest
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {Request.GetChildrenRequest} GetChildrenRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GetChildrenRequest.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a GetChildrenRequest message.
         * @function verify
         * @memberof Request.GetChildrenRequest
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        GetChildrenRequest.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.level != null && message.hasOwnProperty("level"))
                if (!$util.isInteger(message.level))
                    return "level: integer expected";
            if (message.key != null && message.hasOwnProperty("key"))
                if (!(message.key && typeof message.key.length === "number" || $util.isString(message.key)))
                    return "key: buffer expected";
            return null;
        };

        /**
         * Creates a GetChildrenRequest message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof Request.GetChildrenRequest
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {Request.GetChildrenRequest} GetChildrenRequest
         */
        GetChildrenRequest.fromObject = function fromObject(object) {
            if (object instanceof $root.Request.GetChildrenRequest)
                return object;
            var message = new $root.Request.GetChildrenRequest();
            if (object.level != null)
                message.level = object.level >>> 0;
            if (object.key != null)
                if (typeof object.key === "string")
                    $util.base64.decode(object.key, message.key = $util.newBuffer($util.base64.length(object.key)), 0);
                else if (object.key.length >= 0)
                    message.key = object.key;
            return message;
        };

        /**
         * Creates a plain object from a GetChildrenRequest message. Also converts values to other types if specified.
         * @function toObject
         * @memberof Request.GetChildrenRequest
         * @static
         * @param {Request.GetChildrenRequest} message GetChildrenRequest
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        GetChildrenRequest.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.level = 0;
                if (options.bytes === String)
                    object.key = "";
                else {
                    object.key = [];
                    if (options.bytes !== Array)
                        object.key = $util.newBuffer(object.key);
                }
            }
            if (message.level != null && message.hasOwnProperty("level"))
                object.level = message.level;
            if (message.key != null && message.hasOwnProperty("key"))
                object.key = options.bytes === String ? $util.base64.encode(message.key, 0, message.key.length) : options.bytes === Array ? Array.prototype.slice.call(message.key) : message.key;
            return object;
        };

        /**
         * Converts this GetChildrenRequest to JSON.
         * @function toJSON
         * @memberof Request.GetChildrenRequest
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        GetChildrenRequest.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for GetChildrenRequest
         * @function getTypeUrl
         * @memberof Request.GetChildrenRequest
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        GetChildrenRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/Request.GetChildrenRequest";
        };

        return GetChildrenRequest;
    })();

    Request.GetMessagesRequest = (function() {

        /**
         * Properties of a GetMessagesRequest.
         * @memberof Request
         * @interface IGetMessagesRequest
         * @property {Array.<Uint8Array>|null} [ids] GetMessagesRequest ids
         */

        /**
         * Constructs a new GetMessagesRequest.
         * @memberof Request
         * @classdesc Represents a GetMessagesRequest.
         * @implements IGetMessagesRequest
         * @constructor
         * @param {Request.IGetMessagesRequest=} [properties] Properties to set
         */
        function GetMessagesRequest(properties) {
            this.ids = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * GetMessagesRequest ids.
         * @member {Array.<Uint8Array>} ids
         * @memberof Request.GetMessagesRequest
         * @instance
         */
        GetMessagesRequest.prototype.ids = $util.emptyArray;

        /**
         * Creates a new GetMessagesRequest instance using the specified properties.
         * @function create
         * @memberof Request.GetMessagesRequest
         * @static
         * @param {Request.IGetMessagesRequest=} [properties] Properties to set
         * @returns {Request.GetMessagesRequest} GetMessagesRequest instance
         */
        GetMessagesRequest.create = function create(properties) {
            return new GetMessagesRequest(properties);
        };

        /**
         * Encodes the specified GetMessagesRequest message. Does not implicitly {@link Request.GetMessagesRequest.verify|verify} messages.
         * @function encode
         * @memberof Request.GetMessagesRequest
         * @static
         * @param {Request.IGetMessagesRequest} message GetMessagesRequest message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GetMessagesRequest.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.ids != null && message.ids.length)
                for (var i = 0; i < message.ids.length; ++i)
                    writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.ids[i]);
            return writer;
        };

        /**
         * Encodes the specified GetMessagesRequest message, length delimited. Does not implicitly {@link Request.GetMessagesRequest.verify|verify} messages.
         * @function encodeDelimited
         * @memberof Request.GetMessagesRequest
         * @static
         * @param {Request.IGetMessagesRequest} message GetMessagesRequest message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GetMessagesRequest.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a GetMessagesRequest message from the specified reader or buffer.
         * @function decode
         * @memberof Request.GetMessagesRequest
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {Request.GetMessagesRequest} GetMessagesRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GetMessagesRequest.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Request.GetMessagesRequest();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 2: {
                        if (!(message.ids && message.ids.length))
                            message.ids = [];
                        message.ids.push(reader.bytes());
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
         * Decodes a GetMessagesRequest message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof Request.GetMessagesRequest
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {Request.GetMessagesRequest} GetMessagesRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GetMessagesRequest.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a GetMessagesRequest message.
         * @function verify
         * @memberof Request.GetMessagesRequest
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        GetMessagesRequest.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.ids != null && message.hasOwnProperty("ids")) {
                if (!Array.isArray(message.ids))
                    return "ids: array expected";
                for (var i = 0; i < message.ids.length; ++i)
                    if (!(message.ids[i] && typeof message.ids[i].length === "number" || $util.isString(message.ids[i])))
                        return "ids: buffer[] expected";
            }
            return null;
        };

        /**
         * Creates a GetMessagesRequest message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof Request.GetMessagesRequest
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {Request.GetMessagesRequest} GetMessagesRequest
         */
        GetMessagesRequest.fromObject = function fromObject(object) {
            if (object instanceof $root.Request.GetMessagesRequest)
                return object;
            var message = new $root.Request.GetMessagesRequest();
            if (object.ids) {
                if (!Array.isArray(object.ids))
                    throw TypeError(".Request.GetMessagesRequest.ids: array expected");
                message.ids = [];
                for (var i = 0; i < object.ids.length; ++i)
                    if (typeof object.ids[i] === "string")
                        $util.base64.decode(object.ids[i], message.ids[i] = $util.newBuffer($util.base64.length(object.ids[i])), 0);
                    else if (object.ids[i].length >= 0)
                        message.ids[i] = object.ids[i];
            }
            return message;
        };

        /**
         * Creates a plain object from a GetMessagesRequest message. Also converts values to other types if specified.
         * @function toObject
         * @memberof Request.GetMessagesRequest
         * @static
         * @param {Request.GetMessagesRequest} message GetMessagesRequest
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        GetMessagesRequest.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.ids = [];
            if (message.ids && message.ids.length) {
                object.ids = [];
                for (var j = 0; j < message.ids.length; ++j)
                    object.ids[j] = options.bytes === String ? $util.base64.encode(message.ids[j], 0, message.ids[j].length) : options.bytes === Array ? Array.prototype.slice.call(message.ids[j]) : message.ids[j];
            }
            return object;
        };

        /**
         * Converts this GetMessagesRequest to JSON.
         * @function toJSON
         * @memberof Request.GetMessagesRequest
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        GetMessagesRequest.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for GetMessagesRequest
         * @function getTypeUrl
         * @memberof Request.GetMessagesRequest
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        GetMessagesRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/Request.GetMessagesRequest";
        };

        return GetMessagesRequest;
    })();

    return Request;
})();

$root.Response = (function() {

    /**
     * Properties of a Response.
     * @exports IResponse
     * @interface IResponse
     * @property {number|null} [seq] Response seq
     * @property {Response.IGetRootResponse|null} [getRoot] Response getRoot
     * @property {Response.IGetChildrenResponse|null} [getChildren] Response getChildren
     * @property {Response.IGetMessagesResponse|null} [getMessages] Response getMessages
     */

    /**
     * Constructs a new Response.
     * @exports Response
     * @classdesc Represents a Response.
     * @implements IResponse
     * @constructor
     * @param {IResponse=} [properties] Properties to set
     */
    function Response(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Response seq.
     * @member {number} seq
     * @memberof Response
     * @instance
     */
    Response.prototype.seq = 0;

    /**
     * Response getRoot.
     * @member {Response.IGetRootResponse|null|undefined} getRoot
     * @memberof Response
     * @instance
     */
    Response.prototype.getRoot = null;

    /**
     * Response getChildren.
     * @member {Response.IGetChildrenResponse|null|undefined} getChildren
     * @memberof Response
     * @instance
     */
    Response.prototype.getChildren = null;

    /**
     * Response getMessages.
     * @member {Response.IGetMessagesResponse|null|undefined} getMessages
     * @memberof Response
     * @instance
     */
    Response.prototype.getMessages = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * Response response.
     * @member {"getRoot"|"getChildren"|"getMessages"|undefined} response
     * @memberof Response
     * @instance
     */
    Object.defineProperty(Response.prototype, "response", {
        get: $util.oneOfGetter($oneOfFields = ["getRoot", "getChildren", "getMessages"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * Creates a new Response instance using the specified properties.
     * @function create
     * @memberof Response
     * @static
     * @param {IResponse=} [properties] Properties to set
     * @returns {Response} Response instance
     */
    Response.create = function create(properties) {
        return new Response(properties);
    };

    /**
     * Encodes the specified Response message. Does not implicitly {@link Response.verify|verify} messages.
     * @function encode
     * @memberof Response
     * @static
     * @param {IResponse} message Response message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Response.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.seq != null && Object.hasOwnProperty.call(message, "seq"))
            writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.seq);
        if (message.getRoot != null && Object.hasOwnProperty.call(message, "getRoot"))
            $root.Response.GetRootResponse.encode(message.getRoot, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.getChildren != null && Object.hasOwnProperty.call(message, "getChildren"))
            $root.Response.GetChildrenResponse.encode(message.getChildren, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        if (message.getMessages != null && Object.hasOwnProperty.call(message, "getMessages"))
            $root.Response.GetMessagesResponse.encode(message.getMessages, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified Response message, length delimited. Does not implicitly {@link Response.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Response
     * @static
     * @param {IResponse} message Response message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Response.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Response message from the specified reader or buffer.
     * @function decode
     * @memberof Response
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Response} Response
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Response.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Response();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.seq = reader.uint32();
                    break;
                }
            case 2: {
                    message.getRoot = $root.Response.GetRootResponse.decode(reader, reader.uint32());
                    break;
                }
            case 3: {
                    message.getChildren = $root.Response.GetChildrenResponse.decode(reader, reader.uint32());
                    break;
                }
            case 4: {
                    message.getMessages = $root.Response.GetMessagesResponse.decode(reader, reader.uint32());
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
     * Decodes a Response message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Response
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Response} Response
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Response.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Response message.
     * @function verify
     * @memberof Response
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Response.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        var properties = {};
        if (message.seq != null && message.hasOwnProperty("seq"))
            if (!$util.isInteger(message.seq))
                return "seq: integer expected";
        if (message.getRoot != null && message.hasOwnProperty("getRoot")) {
            properties.response = 1;
            {
                var error = $root.Response.GetRootResponse.verify(message.getRoot);
                if (error)
                    return "getRoot." + error;
            }
        }
        if (message.getChildren != null && message.hasOwnProperty("getChildren")) {
            if (properties.response === 1)
                return "response: multiple values";
            properties.response = 1;
            {
                var error = $root.Response.GetChildrenResponse.verify(message.getChildren);
                if (error)
                    return "getChildren." + error;
            }
        }
        if (message.getMessages != null && message.hasOwnProperty("getMessages")) {
            if (properties.response === 1)
                return "response: multiple values";
            properties.response = 1;
            {
                var error = $root.Response.GetMessagesResponse.verify(message.getMessages);
                if (error)
                    return "getMessages." + error;
            }
        }
        return null;
    };

    /**
     * Creates a Response message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Response
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Response} Response
     */
    Response.fromObject = function fromObject(object) {
        if (object instanceof $root.Response)
            return object;
        var message = new $root.Response();
        if (object.seq != null)
            message.seq = object.seq >>> 0;
        if (object.getRoot != null) {
            if (typeof object.getRoot !== "object")
                throw TypeError(".Response.getRoot: object expected");
            message.getRoot = $root.Response.GetRootResponse.fromObject(object.getRoot);
        }
        if (object.getChildren != null) {
            if (typeof object.getChildren !== "object")
                throw TypeError(".Response.getChildren: object expected");
            message.getChildren = $root.Response.GetChildrenResponse.fromObject(object.getChildren);
        }
        if (object.getMessages != null) {
            if (typeof object.getMessages !== "object")
                throw TypeError(".Response.getMessages: object expected");
            message.getMessages = $root.Response.GetMessagesResponse.fromObject(object.getMessages);
        }
        return message;
    };

    /**
     * Creates a plain object from a Response message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Response
     * @static
     * @param {Response} message Response
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Response.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults)
            object.seq = 0;
        if (message.seq != null && message.hasOwnProperty("seq"))
            object.seq = message.seq;
        if (message.getRoot != null && message.hasOwnProperty("getRoot")) {
            object.getRoot = $root.Response.GetRootResponse.toObject(message.getRoot, options);
            if (options.oneofs)
                object.response = "getRoot";
        }
        if (message.getChildren != null && message.hasOwnProperty("getChildren")) {
            object.getChildren = $root.Response.GetChildrenResponse.toObject(message.getChildren, options);
            if (options.oneofs)
                object.response = "getChildren";
        }
        if (message.getMessages != null && message.hasOwnProperty("getMessages")) {
            object.getMessages = $root.Response.GetMessagesResponse.toObject(message.getMessages, options);
            if (options.oneofs)
                object.response = "getMessages";
        }
        return object;
    };

    /**
     * Converts this Response to JSON.
     * @function toJSON
     * @memberof Response
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Response.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Response
     * @function getTypeUrl
     * @memberof Response
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Response.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/Response";
    };

    Response.GetRootResponse = (function() {

        /**
         * Properties of a GetRootResponse.
         * @memberof Response
         * @interface IGetRootResponse
         * @property {INode|null} [root] GetRootResponse root
         */

        /**
         * Constructs a new GetRootResponse.
         * @memberof Response
         * @classdesc Represents a GetRootResponse.
         * @implements IGetRootResponse
         * @constructor
         * @param {Response.IGetRootResponse=} [properties] Properties to set
         */
        function GetRootResponse(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * GetRootResponse root.
         * @member {INode|null|undefined} root
         * @memberof Response.GetRootResponse
         * @instance
         */
        GetRootResponse.prototype.root = null;

        /**
         * Creates a new GetRootResponse instance using the specified properties.
         * @function create
         * @memberof Response.GetRootResponse
         * @static
         * @param {Response.IGetRootResponse=} [properties] Properties to set
         * @returns {Response.GetRootResponse} GetRootResponse instance
         */
        GetRootResponse.create = function create(properties) {
            return new GetRootResponse(properties);
        };

        /**
         * Encodes the specified GetRootResponse message. Does not implicitly {@link Response.GetRootResponse.verify|verify} messages.
         * @function encode
         * @memberof Response.GetRootResponse
         * @static
         * @param {Response.IGetRootResponse} message GetRootResponse message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GetRootResponse.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.root != null && Object.hasOwnProperty.call(message, "root"))
                $root.Node.encode(message.root, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified GetRootResponse message, length delimited. Does not implicitly {@link Response.GetRootResponse.verify|verify} messages.
         * @function encodeDelimited
         * @memberof Response.GetRootResponse
         * @static
         * @param {Response.IGetRootResponse} message GetRootResponse message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GetRootResponse.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a GetRootResponse message from the specified reader or buffer.
         * @function decode
         * @memberof Response.GetRootResponse
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {Response.GetRootResponse} GetRootResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GetRootResponse.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Response.GetRootResponse();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 2: {
                        message.root = $root.Node.decode(reader, reader.uint32());
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
         * Decodes a GetRootResponse message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof Response.GetRootResponse
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {Response.GetRootResponse} GetRootResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GetRootResponse.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a GetRootResponse message.
         * @function verify
         * @memberof Response.GetRootResponse
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        GetRootResponse.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.root != null && message.hasOwnProperty("root")) {
                var error = $root.Node.verify(message.root);
                if (error)
                    return "root." + error;
            }
            return null;
        };

        /**
         * Creates a GetRootResponse message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof Response.GetRootResponse
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {Response.GetRootResponse} GetRootResponse
         */
        GetRootResponse.fromObject = function fromObject(object) {
            if (object instanceof $root.Response.GetRootResponse)
                return object;
            var message = new $root.Response.GetRootResponse();
            if (object.root != null) {
                if (typeof object.root !== "object")
                    throw TypeError(".Response.GetRootResponse.root: object expected");
                message.root = $root.Node.fromObject(object.root);
            }
            return message;
        };

        /**
         * Creates a plain object from a GetRootResponse message. Also converts values to other types if specified.
         * @function toObject
         * @memberof Response.GetRootResponse
         * @static
         * @param {Response.GetRootResponse} message GetRootResponse
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        GetRootResponse.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults)
                object.root = null;
            if (message.root != null && message.hasOwnProperty("root"))
                object.root = $root.Node.toObject(message.root, options);
            return object;
        };

        /**
         * Converts this GetRootResponse to JSON.
         * @function toJSON
         * @memberof Response.GetRootResponse
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        GetRootResponse.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for GetRootResponse
         * @function getTypeUrl
         * @memberof Response.GetRootResponse
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        GetRootResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/Response.GetRootResponse";
        };

        return GetRootResponse;
    })();

    Response.GetChildrenResponse = (function() {

        /**
         * Properties of a GetChildrenResponse.
         * @memberof Response
         * @interface IGetChildrenResponse
         * @property {Array.<INode>|null} [nodes] GetChildrenResponse nodes
         */

        /**
         * Constructs a new GetChildrenResponse.
         * @memberof Response
         * @classdesc Represents a GetChildrenResponse.
         * @implements IGetChildrenResponse
         * @constructor
         * @param {Response.IGetChildrenResponse=} [properties] Properties to set
         */
        function GetChildrenResponse(properties) {
            this.nodes = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * GetChildrenResponse nodes.
         * @member {Array.<INode>} nodes
         * @memberof Response.GetChildrenResponse
         * @instance
         */
        GetChildrenResponse.prototype.nodes = $util.emptyArray;

        /**
         * Creates a new GetChildrenResponse instance using the specified properties.
         * @function create
         * @memberof Response.GetChildrenResponse
         * @static
         * @param {Response.IGetChildrenResponse=} [properties] Properties to set
         * @returns {Response.GetChildrenResponse} GetChildrenResponse instance
         */
        GetChildrenResponse.create = function create(properties) {
            return new GetChildrenResponse(properties);
        };

        /**
         * Encodes the specified GetChildrenResponse message. Does not implicitly {@link Response.GetChildrenResponse.verify|verify} messages.
         * @function encode
         * @memberof Response.GetChildrenResponse
         * @static
         * @param {Response.IGetChildrenResponse} message GetChildrenResponse message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GetChildrenResponse.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.nodes != null && message.nodes.length)
                for (var i = 0; i < message.nodes.length; ++i)
                    $root.Node.encode(message.nodes[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified GetChildrenResponse message, length delimited. Does not implicitly {@link Response.GetChildrenResponse.verify|verify} messages.
         * @function encodeDelimited
         * @memberof Response.GetChildrenResponse
         * @static
         * @param {Response.IGetChildrenResponse} message GetChildrenResponse message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GetChildrenResponse.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a GetChildrenResponse message from the specified reader or buffer.
         * @function decode
         * @memberof Response.GetChildrenResponse
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {Response.GetChildrenResponse} GetChildrenResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GetChildrenResponse.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Response.GetChildrenResponse();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 2: {
                        if (!(message.nodes && message.nodes.length))
                            message.nodes = [];
                        message.nodes.push($root.Node.decode(reader, reader.uint32()));
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
         * Decodes a GetChildrenResponse message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof Response.GetChildrenResponse
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {Response.GetChildrenResponse} GetChildrenResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GetChildrenResponse.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a GetChildrenResponse message.
         * @function verify
         * @memberof Response.GetChildrenResponse
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        GetChildrenResponse.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.nodes != null && message.hasOwnProperty("nodes")) {
                if (!Array.isArray(message.nodes))
                    return "nodes: array expected";
                for (var i = 0; i < message.nodes.length; ++i) {
                    var error = $root.Node.verify(message.nodes[i]);
                    if (error)
                        return "nodes." + error;
                }
            }
            return null;
        };

        /**
         * Creates a GetChildrenResponse message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof Response.GetChildrenResponse
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {Response.GetChildrenResponse} GetChildrenResponse
         */
        GetChildrenResponse.fromObject = function fromObject(object) {
            if (object instanceof $root.Response.GetChildrenResponse)
                return object;
            var message = new $root.Response.GetChildrenResponse();
            if (object.nodes) {
                if (!Array.isArray(object.nodes))
                    throw TypeError(".Response.GetChildrenResponse.nodes: array expected");
                message.nodes = [];
                for (var i = 0; i < object.nodes.length; ++i) {
                    if (typeof object.nodes[i] !== "object")
                        throw TypeError(".Response.GetChildrenResponse.nodes: object expected");
                    message.nodes[i] = $root.Node.fromObject(object.nodes[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a GetChildrenResponse message. Also converts values to other types if specified.
         * @function toObject
         * @memberof Response.GetChildrenResponse
         * @static
         * @param {Response.GetChildrenResponse} message GetChildrenResponse
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        GetChildrenResponse.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.nodes = [];
            if (message.nodes && message.nodes.length) {
                object.nodes = [];
                for (var j = 0; j < message.nodes.length; ++j)
                    object.nodes[j] = $root.Node.toObject(message.nodes[j], options);
            }
            return object;
        };

        /**
         * Converts this GetChildrenResponse to JSON.
         * @function toJSON
         * @memberof Response.GetChildrenResponse
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        GetChildrenResponse.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for GetChildrenResponse
         * @function getTypeUrl
         * @memberof Response.GetChildrenResponse
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        GetChildrenResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/Response.GetChildrenResponse";
        };

        return GetChildrenResponse;
    })();

    Response.GetMessagesResponse = (function() {

        /**
         * Properties of a GetMessagesResponse.
         * @memberof Response
         * @interface IGetMessagesResponse
         * @property {Array.<Uint8Array>|null} [messages] GetMessagesResponse messages
         */

        /**
         * Constructs a new GetMessagesResponse.
         * @memberof Response
         * @classdesc Represents a GetMessagesResponse.
         * @implements IGetMessagesResponse
         * @constructor
         * @param {Response.IGetMessagesResponse=} [properties] Properties to set
         */
        function GetMessagesResponse(properties) {
            this.messages = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * GetMessagesResponse messages.
         * @member {Array.<Uint8Array>} messages
         * @memberof Response.GetMessagesResponse
         * @instance
         */
        GetMessagesResponse.prototype.messages = $util.emptyArray;

        /**
         * Creates a new GetMessagesResponse instance using the specified properties.
         * @function create
         * @memberof Response.GetMessagesResponse
         * @static
         * @param {Response.IGetMessagesResponse=} [properties] Properties to set
         * @returns {Response.GetMessagesResponse} GetMessagesResponse instance
         */
        GetMessagesResponse.create = function create(properties) {
            return new GetMessagesResponse(properties);
        };

        /**
         * Encodes the specified GetMessagesResponse message. Does not implicitly {@link Response.GetMessagesResponse.verify|verify} messages.
         * @function encode
         * @memberof Response.GetMessagesResponse
         * @static
         * @param {Response.IGetMessagesResponse} message GetMessagesResponse message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GetMessagesResponse.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.messages != null && message.messages.length)
                for (var i = 0; i < message.messages.length; ++i)
                    writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.messages[i]);
            return writer;
        };

        /**
         * Encodes the specified GetMessagesResponse message, length delimited. Does not implicitly {@link Response.GetMessagesResponse.verify|verify} messages.
         * @function encodeDelimited
         * @memberof Response.GetMessagesResponse
         * @static
         * @param {Response.IGetMessagesResponse} message GetMessagesResponse message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GetMessagesResponse.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a GetMessagesResponse message from the specified reader or buffer.
         * @function decode
         * @memberof Response.GetMessagesResponse
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {Response.GetMessagesResponse} GetMessagesResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GetMessagesResponse.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Response.GetMessagesResponse();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 2: {
                        if (!(message.messages && message.messages.length))
                            message.messages = [];
                        message.messages.push(reader.bytes());
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
         * Decodes a GetMessagesResponse message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof Response.GetMessagesResponse
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {Response.GetMessagesResponse} GetMessagesResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GetMessagesResponse.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a GetMessagesResponse message.
         * @function verify
         * @memberof Response.GetMessagesResponse
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        GetMessagesResponse.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.messages != null && message.hasOwnProperty("messages")) {
                if (!Array.isArray(message.messages))
                    return "messages: array expected";
                for (var i = 0; i < message.messages.length; ++i)
                    if (!(message.messages[i] && typeof message.messages[i].length === "number" || $util.isString(message.messages[i])))
                        return "messages: buffer[] expected";
            }
            return null;
        };

        /**
         * Creates a GetMessagesResponse message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof Response.GetMessagesResponse
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {Response.GetMessagesResponse} GetMessagesResponse
         */
        GetMessagesResponse.fromObject = function fromObject(object) {
            if (object instanceof $root.Response.GetMessagesResponse)
                return object;
            var message = new $root.Response.GetMessagesResponse();
            if (object.messages) {
                if (!Array.isArray(object.messages))
                    throw TypeError(".Response.GetMessagesResponse.messages: array expected");
                message.messages = [];
                for (var i = 0; i < object.messages.length; ++i)
                    if (typeof object.messages[i] === "string")
                        $util.base64.decode(object.messages[i], message.messages[i] = $util.newBuffer($util.base64.length(object.messages[i])), 0);
                    else if (object.messages[i].length >= 0)
                        message.messages[i] = object.messages[i];
            }
            return message;
        };

        /**
         * Creates a plain object from a GetMessagesResponse message. Also converts values to other types if specified.
         * @function toObject
         * @memberof Response.GetMessagesResponse
         * @static
         * @param {Response.GetMessagesResponse} message GetMessagesResponse
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        GetMessagesResponse.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.messages = [];
            if (message.messages && message.messages.length) {
                object.messages = [];
                for (var j = 0; j < message.messages.length; ++j)
                    object.messages[j] = options.bytes === String ? $util.base64.encode(message.messages[j], 0, message.messages[j].length) : options.bytes === Array ? Array.prototype.slice.call(message.messages[j]) : message.messages[j];
            }
            return object;
        };

        /**
         * Converts this GetMessagesResponse to JSON.
         * @function toJSON
         * @memberof Response.GetMessagesResponse
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        GetMessagesResponse.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for GetMessagesResponse
         * @function getTypeUrl
         * @memberof Response.GetMessagesResponse
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        GetMessagesResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/Response.GetMessagesResponse";
        };

        return GetMessagesResponse;
    })();

    return Response;
})();

module.exports = $root;
