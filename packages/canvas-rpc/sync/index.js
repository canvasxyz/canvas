/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
(function(global, factory) { /* global define, require, module */

    /* AMD */ if (typeof define === 'function' && define.amd)
        define(["protobufjs/minimal"], factory);

    /* CommonJS */ else if (typeof require === 'function' && typeof module === 'object' && module && module.exports)
        module.exports = factory(require("protobufjs/minimal"));

})(this, function($protobuf) {
    "use strict";

    // Common aliases
    var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;
    
    // Exported root namespace
    var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});
    
    $root.Node = (function() {
    
        /**
         * Properties of a Node.
         * @exports INode
         * @interface INode
         * @property {Uint8Array|null} [leaf] Node leaf
         * @property {Uint8Array|null} [hash] Node hash
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
         * Node leaf.
         * @member {Uint8Array} leaf
         * @memberof Node
         * @instance
         */
        Node.prototype.leaf = $util.newBuffer([]);
    
        /**
         * Node hash.
         * @member {Uint8Array} hash
         * @memberof Node
         * @instance
         */
        Node.prototype.hash = $util.newBuffer([]);
    
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
            if (message.leaf != null && Object.hasOwnProperty.call(message, "leaf"))
                writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.leaf);
            if (message.hash != null && Object.hasOwnProperty.call(message, "hash"))
                writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.hash);
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
                        message.leaf = reader.bytes();
                        break;
                    }
                case 2: {
                        message.hash = reader.bytes();
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
            if (message.leaf != null && message.hasOwnProperty("leaf"))
                if (!(message.leaf && typeof message.leaf.length === "number" || $util.isString(message.leaf)))
                    return "leaf: buffer expected";
            if (message.hash != null && message.hasOwnProperty("hash"))
                if (!(message.hash && typeof message.hash.length === "number" || $util.isString(message.hash)))
                    return "hash: buffer expected";
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
            if (object.leaf != null)
                if (typeof object.leaf === "string")
                    $util.base64.decode(object.leaf, message.leaf = $util.newBuffer($util.base64.length(object.leaf)), 0);
                else if (object.leaf.length >= 0)
                    message.leaf = object.leaf;
            if (object.hash != null)
                if (typeof object.hash === "string")
                    $util.base64.decode(object.hash, message.hash = $util.newBuffer($util.base64.length(object.hash)), 0);
                else if (object.hash.length >= 0)
                    message.hash = object.hash;
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
                if (options.bytes === String)
                    object.leaf = "";
                else {
                    object.leaf = [];
                    if (options.bytes !== Array)
                        object.leaf = $util.newBuffer(object.leaf);
                }
                if (options.bytes === String)
                    object.hash = "";
                else {
                    object.hash = [];
                    if (options.bytes !== Array)
                        object.hash = $util.newBuffer(object.hash);
                }
            }
            if (message.leaf != null && message.hasOwnProperty("leaf"))
                object.leaf = options.bytes === String ? $util.base64.encode(message.leaf, 0, message.leaf.length) : options.bytes === Array ? Array.prototype.slice.call(message.leaf) : message.leaf;
            if (message.hash != null && message.hasOwnProperty("hash"))
                object.hash = options.bytes === String ? $util.base64.encode(message.hash, 0, message.hash.length) : options.bytes === Array ? Array.prototype.slice.call(message.hash) : message.hash;
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
         * @property {Request.IGetValuesRequest|null} [getValues] Request getValues
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
         * Request getValues.
         * @member {Request.IGetValuesRequest|null|undefined} getValues
         * @memberof Request
         * @instance
         */
        Request.prototype.getValues = null;
    
        // OneOf field names bound to virtual getters and setters
        var $oneOfFields;
    
        /**
         * Request request.
         * @member {"getRoot"|"getChildren"|"getValues"|undefined} request
         * @memberof Request
         * @instance
         */
        Object.defineProperty(Request.prototype, "request", {
            get: $util.oneOfGetter($oneOfFields = ["getRoot", "getChildren", "getValues"]),
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
            if (message.getValues != null && Object.hasOwnProperty.call(message, "getValues"))
                $root.Request.GetValuesRequest.encode(message.getValues, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
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
                        message.getValues = $root.Request.GetValuesRequest.decode(reader, reader.uint32());
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
            if (message.getValues != null && message.hasOwnProperty("getValues")) {
                if (properties.request === 1)
                    return "request: multiple values";
                properties.request = 1;
                {
                    var error = $root.Request.GetValuesRequest.verify(message.getValues);
                    if (error)
                        return "getValues." + error;
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
            if (object.getValues != null) {
                if (typeof object.getValues !== "object")
                    throw TypeError(".Request.getValues: object expected");
                message.getValues = $root.Request.GetValuesRequest.fromObject(object.getValues);
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
            if (message.getValues != null && message.hasOwnProperty("getValues")) {
                object.getValues = $root.Request.GetValuesRequest.toObject(message.getValues, options);
                if (options.oneofs)
                    object.request = "getValues";
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
             * @property {Uint8Array|null} [leaf] GetChildrenRequest leaf
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
             * GetChildrenRequest leaf.
             * @member {Uint8Array} leaf
             * @memberof Request.GetChildrenRequest
             * @instance
             */
            GetChildrenRequest.prototype.leaf = $util.newBuffer([]);
    
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
                    writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.level);
                if (message.leaf != null && Object.hasOwnProperty.call(message, "leaf"))
                    writer.uint32(/* id 4, wireType 2 =*/34).bytes(message.leaf);
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
                    case 3: {
                            message.level = reader.uint32();
                            break;
                        }
                    case 4: {
                            message.leaf = reader.bytes();
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
                if (message.leaf != null && message.hasOwnProperty("leaf"))
                    if (!(message.leaf && typeof message.leaf.length === "number" || $util.isString(message.leaf)))
                        return "leaf: buffer expected";
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
                if (object.leaf != null)
                    if (typeof object.leaf === "string")
                        $util.base64.decode(object.leaf, message.leaf = $util.newBuffer($util.base64.length(object.leaf)), 0);
                    else if (object.leaf.length >= 0)
                        message.leaf = object.leaf;
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
                        object.leaf = "";
                    else {
                        object.leaf = [];
                        if (options.bytes !== Array)
                            object.leaf = $util.newBuffer(object.leaf);
                    }
                }
                if (message.level != null && message.hasOwnProperty("level"))
                    object.level = message.level;
                if (message.leaf != null && message.hasOwnProperty("leaf"))
                    object.leaf = options.bytes === String ? $util.base64.encode(message.leaf, 0, message.leaf.length) : options.bytes === Array ? Array.prototype.slice.call(message.leaf) : message.leaf;
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
    
        Request.GetValuesRequest = (function() {
    
            /**
             * Properties of a GetValuesRequest.
             * @memberof Request
             * @interface IGetValuesRequest
             * @property {Array.<INode>|null} [nodes] GetValuesRequest nodes
             */
    
            /**
             * Constructs a new GetValuesRequest.
             * @memberof Request
             * @classdesc Represents a GetValuesRequest.
             * @implements IGetValuesRequest
             * @constructor
             * @param {Request.IGetValuesRequest=} [properties] Properties to set
             */
            function GetValuesRequest(properties) {
                this.nodes = [];
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }
    
            /**
             * GetValuesRequest nodes.
             * @member {Array.<INode>} nodes
             * @memberof Request.GetValuesRequest
             * @instance
             */
            GetValuesRequest.prototype.nodes = $util.emptyArray;
    
            /**
             * Creates a new GetValuesRequest instance using the specified properties.
             * @function create
             * @memberof Request.GetValuesRequest
             * @static
             * @param {Request.IGetValuesRequest=} [properties] Properties to set
             * @returns {Request.GetValuesRequest} GetValuesRequest instance
             */
            GetValuesRequest.create = function create(properties) {
                return new GetValuesRequest(properties);
            };
    
            /**
             * Encodes the specified GetValuesRequest message. Does not implicitly {@link Request.GetValuesRequest.verify|verify} messages.
             * @function encode
             * @memberof Request.GetValuesRequest
             * @static
             * @param {Request.IGetValuesRequest} message GetValuesRequest message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            GetValuesRequest.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.nodes != null && message.nodes.length)
                    for (var i = 0; i < message.nodes.length; ++i)
                        $root.Node.encode(message.nodes[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                return writer;
            };
    
            /**
             * Encodes the specified GetValuesRequest message, length delimited. Does not implicitly {@link Request.GetValuesRequest.verify|verify} messages.
             * @function encodeDelimited
             * @memberof Request.GetValuesRequest
             * @static
             * @param {Request.IGetValuesRequest} message GetValuesRequest message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            GetValuesRequest.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };
    
            /**
             * Decodes a GetValuesRequest message from the specified reader or buffer.
             * @function decode
             * @memberof Request.GetValuesRequest
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {Request.GetValuesRequest} GetValuesRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            GetValuesRequest.decode = function decode(reader, length) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Request.GetValuesRequest();
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
             * Decodes a GetValuesRequest message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof Request.GetValuesRequest
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {Request.GetValuesRequest} GetValuesRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            GetValuesRequest.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };
    
            /**
             * Verifies a GetValuesRequest message.
             * @function verify
             * @memberof Request.GetValuesRequest
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            GetValuesRequest.verify = function verify(message) {
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
             * Creates a GetValuesRequest message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof Request.GetValuesRequest
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {Request.GetValuesRequest} GetValuesRequest
             */
            GetValuesRequest.fromObject = function fromObject(object) {
                if (object instanceof $root.Request.GetValuesRequest)
                    return object;
                var message = new $root.Request.GetValuesRequest();
                if (object.nodes) {
                    if (!Array.isArray(object.nodes))
                        throw TypeError(".Request.GetValuesRequest.nodes: array expected");
                    message.nodes = [];
                    for (var i = 0; i < object.nodes.length; ++i) {
                        if (typeof object.nodes[i] !== "object")
                            throw TypeError(".Request.GetValuesRequest.nodes: object expected");
                        message.nodes[i] = $root.Node.fromObject(object.nodes[i]);
                    }
                }
                return message;
            };
    
            /**
             * Creates a plain object from a GetValuesRequest message. Also converts values to other types if specified.
             * @function toObject
             * @memberof Request.GetValuesRequest
             * @static
             * @param {Request.GetValuesRequest} message GetValuesRequest
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            GetValuesRequest.toObject = function toObject(message, options) {
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
             * Converts this GetValuesRequest to JSON.
             * @function toJSON
             * @memberof Request.GetValuesRequest
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            GetValuesRequest.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };
    
            /**
             * Gets the default type url for GetValuesRequest
             * @function getTypeUrl
             * @memberof Request.GetValuesRequest
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            GetValuesRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/Request.GetValuesRequest";
            };
    
            return GetValuesRequest;
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
         * @property {Response.IGetValuesResponse|null} [getValues] Response getValues
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
         * Response getValues.
         * @member {Response.IGetValuesResponse|null|undefined} getValues
         * @memberof Response
         * @instance
         */
        Response.prototype.getValues = null;
    
        // OneOf field names bound to virtual getters and setters
        var $oneOfFields;
    
        /**
         * Response response.
         * @member {"getRoot"|"getChildren"|"getValues"|undefined} response
         * @memberof Response
         * @instance
         */
        Object.defineProperty(Response.prototype, "response", {
            get: $util.oneOfGetter($oneOfFields = ["getRoot", "getChildren", "getValues"]),
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
            if (message.getValues != null && Object.hasOwnProperty.call(message, "getValues"))
                $root.Response.GetValuesResponse.encode(message.getValues, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
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
                        message.getValues = $root.Response.GetValuesResponse.decode(reader, reader.uint32());
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
            if (message.getValues != null && message.hasOwnProperty("getValues")) {
                if (properties.response === 1)
                    return "response: multiple values";
                properties.response = 1;
                {
                    var error = $root.Response.GetValuesResponse.verify(message.getValues);
                    if (error)
                        return "getValues." + error;
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
            if (object.getValues != null) {
                if (typeof object.getValues !== "object")
                    throw TypeError(".Response.getValues: object expected");
                message.getValues = $root.Response.GetValuesResponse.fromObject(object.getValues);
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
            if (message.getValues != null && message.hasOwnProperty("getValues")) {
                object.getValues = $root.Response.GetValuesResponse.toObject(message.getValues, options);
                if (options.oneofs)
                    object.response = "getValues";
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
             * @property {number|null} [level] GetRootResponse level
             * @property {Uint8Array|null} [hash] GetRootResponse hash
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
             * GetRootResponse level.
             * @member {number} level
             * @memberof Response.GetRootResponse
             * @instance
             */
            GetRootResponse.prototype.level = 0;
    
            /**
             * GetRootResponse hash.
             * @member {Uint8Array} hash
             * @memberof Response.GetRootResponse
             * @instance
             */
            GetRootResponse.prototype.hash = $util.newBuffer([]);
    
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
                if (message.level != null && Object.hasOwnProperty.call(message, "level"))
                    writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.level);
                if (message.hash != null && Object.hasOwnProperty.call(message, "hash"))
                    writer.uint32(/* id 3, wireType 2 =*/26).bytes(message.hash);
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
                            message.level = reader.uint32();
                            break;
                        }
                    case 3: {
                            message.hash = reader.bytes();
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
                if (message.level != null && message.hasOwnProperty("level"))
                    if (!$util.isInteger(message.level))
                        return "level: integer expected";
                if (message.hash != null && message.hasOwnProperty("hash"))
                    if (!(message.hash && typeof message.hash.length === "number" || $util.isString(message.hash)))
                        return "hash: buffer expected";
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
                if (object.level != null)
                    message.level = object.level >>> 0;
                if (object.hash != null)
                    if (typeof object.hash === "string")
                        $util.base64.decode(object.hash, message.hash = $util.newBuffer($util.base64.length(object.hash)), 0);
                    else if (object.hash.length >= 0)
                        message.hash = object.hash;
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
                if (options.defaults) {
                    object.level = 0;
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
                if (message.hash != null && message.hasOwnProperty("hash"))
                    object.hash = options.bytes === String ? $util.base64.encode(message.hash, 0, message.hash.length) : options.bytes === Array ? Array.prototype.slice.call(message.hash) : message.hash;
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
    
        Response.GetValuesResponse = (function() {
    
            /**
             * Properties of a GetValuesResponse.
             * @memberof Response
             * @interface IGetValuesResponse
             * @property {Array.<Uint8Array>|null} [values] GetValuesResponse values
             */
    
            /**
             * Constructs a new GetValuesResponse.
             * @memberof Response
             * @classdesc Represents a GetValuesResponse.
             * @implements IGetValuesResponse
             * @constructor
             * @param {Response.IGetValuesResponse=} [properties] Properties to set
             */
            function GetValuesResponse(properties) {
                this.values = [];
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }
    
            /**
             * GetValuesResponse values.
             * @member {Array.<Uint8Array>} values
             * @memberof Response.GetValuesResponse
             * @instance
             */
            GetValuesResponse.prototype.values = $util.emptyArray;
    
            /**
             * Creates a new GetValuesResponse instance using the specified properties.
             * @function create
             * @memberof Response.GetValuesResponse
             * @static
             * @param {Response.IGetValuesResponse=} [properties] Properties to set
             * @returns {Response.GetValuesResponse} GetValuesResponse instance
             */
            GetValuesResponse.create = function create(properties) {
                return new GetValuesResponse(properties);
            };
    
            /**
             * Encodes the specified GetValuesResponse message. Does not implicitly {@link Response.GetValuesResponse.verify|verify} messages.
             * @function encode
             * @memberof Response.GetValuesResponse
             * @static
             * @param {Response.IGetValuesResponse} message GetValuesResponse message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            GetValuesResponse.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.values != null && message.values.length)
                    for (var i = 0; i < message.values.length; ++i)
                        writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.values[i]);
                return writer;
            };
    
            /**
             * Encodes the specified GetValuesResponse message, length delimited. Does not implicitly {@link Response.GetValuesResponse.verify|verify} messages.
             * @function encodeDelimited
             * @memberof Response.GetValuesResponse
             * @static
             * @param {Response.IGetValuesResponse} message GetValuesResponse message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            GetValuesResponse.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };
    
            /**
             * Decodes a GetValuesResponse message from the specified reader or buffer.
             * @function decode
             * @memberof Response.GetValuesResponse
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {Response.GetValuesResponse} GetValuesResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            GetValuesResponse.decode = function decode(reader, length) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Response.GetValuesResponse();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    switch (tag >>> 3) {
                    case 2: {
                            if (!(message.values && message.values.length))
                                message.values = [];
                            message.values.push(reader.bytes());
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
             * Decodes a GetValuesResponse message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof Response.GetValuesResponse
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {Response.GetValuesResponse} GetValuesResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            GetValuesResponse.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };
    
            /**
             * Verifies a GetValuesResponse message.
             * @function verify
             * @memberof Response.GetValuesResponse
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            GetValuesResponse.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.values != null && message.hasOwnProperty("values")) {
                    if (!Array.isArray(message.values))
                        return "values: array expected";
                    for (var i = 0; i < message.values.length; ++i)
                        if (!(message.values[i] && typeof message.values[i].length === "number" || $util.isString(message.values[i])))
                            return "values: buffer[] expected";
                }
                return null;
            };
    
            /**
             * Creates a GetValuesResponse message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof Response.GetValuesResponse
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {Response.GetValuesResponse} GetValuesResponse
             */
            GetValuesResponse.fromObject = function fromObject(object) {
                if (object instanceof $root.Response.GetValuesResponse)
                    return object;
                var message = new $root.Response.GetValuesResponse();
                if (object.values) {
                    if (!Array.isArray(object.values))
                        throw TypeError(".Response.GetValuesResponse.values: array expected");
                    message.values = [];
                    for (var i = 0; i < object.values.length; ++i)
                        if (typeof object.values[i] === "string")
                            $util.base64.decode(object.values[i], message.values[i] = $util.newBuffer($util.base64.length(object.values[i])), 0);
                        else if (object.values[i].length >= 0)
                            message.values[i] = object.values[i];
                }
                return message;
            };
    
            /**
             * Creates a plain object from a GetValuesResponse message. Also converts values to other types if specified.
             * @function toObject
             * @memberof Response.GetValuesResponse
             * @static
             * @param {Response.GetValuesResponse} message GetValuesResponse
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            GetValuesResponse.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.arrays || options.defaults)
                    object.values = [];
                if (message.values && message.values.length) {
                    object.values = [];
                    for (var j = 0; j < message.values.length; ++j)
                        object.values[j] = options.bytes === String ? $util.base64.encode(message.values[j], 0, message.values[j].length) : options.bytes === Array ? Array.prototype.slice.call(message.values[j]) : message.values[j];
                }
                return object;
            };
    
            /**
             * Converts this GetValuesResponse to JSON.
             * @function toJSON
             * @memberof Response.GetValuesResponse
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            GetValuesResponse.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };
    
            /**
             * Gets the default type url for GetValuesResponse
             * @function getTypeUrl
             * @memberof Response.GetValuesResponse
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            GetValuesResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/Response.GetValuesResponse";
            };
    
            return GetValuesResponse;
        })();
    
        return Response;
    })();

    return $root;
});
