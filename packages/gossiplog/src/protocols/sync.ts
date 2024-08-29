/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { type Codec, decodeMessage, type DecodeOptions, encodeMessage, MaxLengthError, message } from 'protons-runtime'
import { alloc as uint8ArrayAlloc } from 'uint8arrays/alloc'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface Node {
  level: number
  key?: Uint8Array
  hash: Uint8Array
}

export namespace Node {
  let _codec: Codec<Node>

  export const codec = (): Codec<Node> => {
    if (_codec == null) {
      _codec = message<Node>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.level != null && obj.level !== 0)) {
          w.uint32(8)
          w.uint32(obj.level)
        }

        if (obj.key != null) {
          w.uint32(18)
          w.bytes(obj.key)
        }

        if ((obj.hash != null && obj.hash.byteLength > 0)) {
          w.uint32(26)
          w.bytes(obj.hash)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          level: 0,
          hash: uint8ArrayAlloc(0)
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.level = reader.uint32()
              break
            }
            case 2: {
              obj.key = reader.bytes()
              break
            }
            case 3: {
              obj.hash = reader.bytes()
              break
            }
            default: {
              reader.skipType(tag & 7)
              break
            }
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: Partial<Node>): Uint8Array => {
    return encodeMessage(obj, Node.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<Node>): Node => {
    return decodeMessage(buf, Node.codec(), opts)
  }
}

export interface Request {
  getRoot?: Request.GetRootRequest
  getNode?: Request.GetNodeRequest
  getChildren?: Request.GetChildrenRequest
  getValues?: Request.GetValuesRequest
}

export namespace Request {
  export interface GetRootRequest {}

  export namespace GetRootRequest {
    let _codec: Codec<GetRootRequest>

    export const codec = (): Codec<GetRootRequest> => {
      if (_codec == null) {
        _codec = message<GetRootRequest>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length, opts = {}) => {
          const obj: any = {}

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              default: {
                reader.skipType(tag & 7)
                break
              }
            }
          }

          return obj
        })
      }

      return _codec
    }

    export const encode = (obj: Partial<GetRootRequest>): Uint8Array => {
      return encodeMessage(obj, GetRootRequest.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<GetRootRequest>): GetRootRequest => {
      return decodeMessage(buf, GetRootRequest.codec(), opts)
    }
  }

  export interface GetNodeRequest {
    level: number
    key?: Uint8Array
  }

  export namespace GetNodeRequest {
    let _codec: Codec<GetNodeRequest>

    export const codec = (): Codec<GetNodeRequest> => {
      if (_codec == null) {
        _codec = message<GetNodeRequest>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if ((obj.level != null && obj.level !== 0)) {
            w.uint32(8)
            w.uint32(obj.level)
          }

          if (obj.key != null) {
            w.uint32(18)
            w.bytes(obj.key)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length, opts = {}) => {
          const obj: any = {
            level: 0
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1: {
                obj.level = reader.uint32()
                break
              }
              case 2: {
                obj.key = reader.bytes()
                break
              }
              default: {
                reader.skipType(tag & 7)
                break
              }
            }
          }

          return obj
        })
      }

      return _codec
    }

    export const encode = (obj: Partial<GetNodeRequest>): Uint8Array => {
      return encodeMessage(obj, GetNodeRequest.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<GetNodeRequest>): GetNodeRequest => {
      return decodeMessage(buf, GetNodeRequest.codec(), opts)
    }
  }

  export interface GetChildrenRequest {
    level: number
    key?: Uint8Array
  }

  export namespace GetChildrenRequest {
    let _codec: Codec<GetChildrenRequest>

    export const codec = (): Codec<GetChildrenRequest> => {
      if (_codec == null) {
        _codec = message<GetChildrenRequest>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if ((obj.level != null && obj.level !== 0)) {
            w.uint32(8)
            w.uint32(obj.level)
          }

          if (obj.key != null) {
            w.uint32(18)
            w.bytes(obj.key)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length, opts = {}) => {
          const obj: any = {
            level: 0
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1: {
                obj.level = reader.uint32()
                break
              }
              case 2: {
                obj.key = reader.bytes()
                break
              }
              default: {
                reader.skipType(tag & 7)
                break
              }
            }
          }

          return obj
        })
      }

      return _codec
    }

    export const encode = (obj: Partial<GetChildrenRequest>): Uint8Array => {
      return encodeMessage(obj, GetChildrenRequest.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<GetChildrenRequest>): GetChildrenRequest => {
      return decodeMessage(buf, GetChildrenRequest.codec(), opts)
    }
  }

  export interface GetValuesRequest {
    keys: Uint8Array[]
  }

  export namespace GetValuesRequest {
    let _codec: Codec<GetValuesRequest>

    export const codec = (): Codec<GetValuesRequest> => {
      if (_codec == null) {
        _codec = message<GetValuesRequest>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if (obj.keys != null) {
            for (const value of obj.keys) {
              w.uint32(10)
              w.bytes(value)
            }
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length, opts = {}) => {
          const obj: any = {
            keys: []
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1: {
                if (opts.limits?.keys != null && obj.keys.length === opts.limits.keys) {
                  throw new MaxLengthError('Decode error - map field "keys" had too many elements')
                }

                obj.keys.push(reader.bytes())
                break
              }
              default: {
                reader.skipType(tag & 7)
                break
              }
            }
          }

          return obj
        })
      }

      return _codec
    }

    export const encode = (obj: Partial<GetValuesRequest>): Uint8Array => {
      return encodeMessage(obj, GetValuesRequest.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<GetValuesRequest>): GetValuesRequest => {
      return decodeMessage(buf, GetValuesRequest.codec(), opts)
    }
  }

  let _codec: Codec<Request>

  export const codec = (): Codec<Request> => {
    if (_codec == null) {
      _codec = message<Request>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.getRoot != null) {
          w.uint32(10)
          Request.GetRootRequest.codec().encode(obj.getRoot, w)
        }

        if (obj.getNode != null) {
          w.uint32(18)
          Request.GetNodeRequest.codec().encode(obj.getNode, w)
        }

        if (obj.getChildren != null) {
          w.uint32(26)
          Request.GetChildrenRequest.codec().encode(obj.getChildren, w)
        }

        if (obj.getValues != null) {
          w.uint32(34)
          Request.GetValuesRequest.codec().encode(obj.getValues, w)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {}

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.getRoot = Request.GetRootRequest.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.getRoot
              })
              break
            }
            case 2: {
              obj.getNode = Request.GetNodeRequest.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.getNode
              })
              break
            }
            case 3: {
              obj.getChildren = Request.GetChildrenRequest.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.getChildren
              })
              break
            }
            case 4: {
              obj.getValues = Request.GetValuesRequest.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.getValues
              })
              break
            }
            default: {
              reader.skipType(tag & 7)
              break
            }
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: Partial<Request>): Uint8Array => {
    return encodeMessage(obj, Request.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<Request>): Request => {
    return decodeMessage(buf, Request.codec(), opts)
  }
}

export interface Response {
  getRoot?: Response.GetRootResponse
  getNode?: Response.GetNodeResponse
  getChildren?: Response.GetChildrenResponse
  getValues?: Response.GetValuesResponse
  abort?: Response.AbortSignal
}

export namespace Response {
  export interface GetRootResponse {
    root?: Node
  }

  export namespace GetRootResponse {
    let _codec: Codec<GetRootResponse>

    export const codec = (): Codec<GetRootResponse> => {
      if (_codec == null) {
        _codec = message<GetRootResponse>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if (obj.root != null) {
            w.uint32(10)
            Node.codec().encode(obj.root, w)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length, opts = {}) => {
          const obj: any = {}

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1: {
                obj.root = Node.codec().decode(reader, reader.uint32(), {
                  limits: opts.limits?.root
                })
                break
              }
              default: {
                reader.skipType(tag & 7)
                break
              }
            }
          }

          return obj
        })
      }

      return _codec
    }

    export const encode = (obj: Partial<GetRootResponse>): Uint8Array => {
      return encodeMessage(obj, GetRootResponse.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<GetRootResponse>): GetRootResponse => {
      return decodeMessage(buf, GetRootResponse.codec(), opts)
    }
  }

  export interface GetNodeResponse {
    node?: Node
  }

  export namespace GetNodeResponse {
    let _codec: Codec<GetNodeResponse>

    export const codec = (): Codec<GetNodeResponse> => {
      if (_codec == null) {
        _codec = message<GetNodeResponse>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if (obj.node != null) {
            w.uint32(10)
            Node.codec().encode(obj.node, w)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length, opts = {}) => {
          const obj: any = {}

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1: {
                obj.node = Node.codec().decode(reader, reader.uint32(), {
                  limits: opts.limits?.node
                })
                break
              }
              default: {
                reader.skipType(tag & 7)
                break
              }
            }
          }

          return obj
        })
      }

      return _codec
    }

    export const encode = (obj: Partial<GetNodeResponse>): Uint8Array => {
      return encodeMessage(obj, GetNodeResponse.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<GetNodeResponse>): GetNodeResponse => {
      return decodeMessage(buf, GetNodeResponse.codec(), opts)
    }
  }

  export interface GetChildrenResponse {
    children: Node[]
  }

  export namespace GetChildrenResponse {
    let _codec: Codec<GetChildrenResponse>

    export const codec = (): Codec<GetChildrenResponse> => {
      if (_codec == null) {
        _codec = message<GetChildrenResponse>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if (obj.children != null) {
            for (const value of obj.children) {
              w.uint32(10)
              Node.codec().encode(value, w)
            }
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length, opts = {}) => {
          const obj: any = {
            children: []
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1: {
                if (opts.limits?.children != null && obj.children.length === opts.limits.children) {
                  throw new MaxLengthError('Decode error - map field "children" had too many elements')
                }

                obj.children.push(Node.codec().decode(reader, reader.uint32(), {
                  limits: opts.limits?.children$
                }))
                break
              }
              default: {
                reader.skipType(tag & 7)
                break
              }
            }
          }

          return obj
        })
      }

      return _codec
    }

    export const encode = (obj: Partial<GetChildrenResponse>): Uint8Array => {
      return encodeMessage(obj, GetChildrenResponse.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<GetChildrenResponse>): GetChildrenResponse => {
      return decodeMessage(buf, GetChildrenResponse.codec(), opts)
    }
  }

  export interface GetValuesResponse {
    values: Uint8Array[]
  }

  export namespace GetValuesResponse {
    let _codec: Codec<GetValuesResponse>

    export const codec = (): Codec<GetValuesResponse> => {
      if (_codec == null) {
        _codec = message<GetValuesResponse>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if (obj.values != null) {
            for (const value of obj.values) {
              w.uint32(10)
              w.bytes(value)
            }
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length, opts = {}) => {
          const obj: any = {
            values: []
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1: {
                if (opts.limits?.values != null && obj.values.length === opts.limits.values) {
                  throw new MaxLengthError('Decode error - map field "values" had too many elements')
                }

                obj.values.push(reader.bytes())
                break
              }
              default: {
                reader.skipType(tag & 7)
                break
              }
            }
          }

          return obj
        })
      }

      return _codec
    }

    export const encode = (obj: Partial<GetValuesResponse>): Uint8Array => {
      return encodeMessage(obj, GetValuesResponse.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<GetValuesResponse>): GetValuesResponse => {
      return decodeMessage(buf, GetValuesResponse.codec(), opts)
    }
  }

  export interface AbortSignal {
    cooldown: number
  }

  export namespace AbortSignal {
    let _codec: Codec<AbortSignal>

    export const codec = (): Codec<AbortSignal> => {
      if (_codec == null) {
        _codec = message<AbortSignal>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if ((obj.cooldown != null && obj.cooldown !== 0)) {
            w.uint32(8)
            w.uint32(obj.cooldown)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length, opts = {}) => {
          const obj: any = {
            cooldown: 0
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1: {
                obj.cooldown = reader.uint32()
                break
              }
              default: {
                reader.skipType(tag & 7)
                break
              }
            }
          }

          return obj
        })
      }

      return _codec
    }

    export const encode = (obj: Partial<AbortSignal>): Uint8Array => {
      return encodeMessage(obj, AbortSignal.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<AbortSignal>): AbortSignal => {
      return decodeMessage(buf, AbortSignal.codec(), opts)
    }
  }

  let _codec: Codec<Response>

  export const codec = (): Codec<Response> => {
    if (_codec == null) {
      _codec = message<Response>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.getRoot != null) {
          w.uint32(10)
          Response.GetRootResponse.codec().encode(obj.getRoot, w)
        }

        if (obj.getNode != null) {
          w.uint32(18)
          Response.GetNodeResponse.codec().encode(obj.getNode, w)
        }

        if (obj.getChildren != null) {
          w.uint32(26)
          Response.GetChildrenResponse.codec().encode(obj.getChildren, w)
        }

        if (obj.getValues != null) {
          w.uint32(34)
          Response.GetValuesResponse.codec().encode(obj.getValues, w)
        }

        if (obj.abort != null) {
          w.uint32(42)
          Response.AbortSignal.codec().encode(obj.abort, w)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {}

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.getRoot = Response.GetRootResponse.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.getRoot
              })
              break
            }
            case 2: {
              obj.getNode = Response.GetNodeResponse.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.getNode
              })
              break
            }
            case 3: {
              obj.getChildren = Response.GetChildrenResponse.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.getChildren
              })
              break
            }
            case 4: {
              obj.getValues = Response.GetValuesResponse.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.getValues
              })
              break
            }
            case 5: {
              obj.abort = Response.AbortSignal.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.abort
              })
              break
            }
            default: {
              reader.skipType(tag & 7)
              break
            }
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: Partial<Response>): Uint8Array => {
    return encodeMessage(obj, Response.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<Response>): Response => {
    return decodeMessage(buf, Response.codec(), opts)
  }
}
