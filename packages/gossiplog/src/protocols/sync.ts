/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { encodeMessage, decodeMessage, message } from 'protons-runtime'
import type { Codec } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface Node {
  level: number
  key: Uint8Array
  hash: Uint8Array
  value?: Uint8Array
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

        if ((obj.key != null && obj.key.byteLength > 0)) {
          w.uint32(18)
          w.bytes(obj.key)
        }

        if ((obj.hash != null && obj.hash.byteLength > 0)) {
          w.uint32(26)
          w.bytes(obj.hash)
        }

        if (obj.value != null) {
          w.uint32(34)
          w.bytes(obj.value)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          level: 0,
          key: new Uint8Array(0),
          hash: new Uint8Array(0)
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.level = reader.uint32()
              break
            case 2:
              obj.key = reader.bytes()
              break
            case 3:
              obj.hash = reader.bytes()
              break
            case 4:
              obj.value = reader.bytes()
              break
            default:
              reader.skipType(tag & 7)
              break
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

  export const decode = (buf: Uint8Array | Uint8ArrayList): Node => {
    return decodeMessage(buf, Node.codec())
  }
}

export interface Request {
  getRoot?: Request.GetRootRequest
  getNode?: Request.GetNodeRequest
  getChildren?: Request.GetChildrenRequest
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
        }, (reader, length) => {
          const obj: any = {}

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              default:
                reader.skipType(tag & 7)
                break
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

    export const decode = (buf: Uint8Array | Uint8ArrayList): GetRootRequest => {
      return decodeMessage(buf, GetRootRequest.codec())
    }
  }

  export interface GetNodeRequest {
    level: number
    key: Uint8Array
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

          if ((obj.key != null && obj.key.byteLength > 0)) {
            w.uint32(18)
            w.bytes(obj.key)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length) => {
          const obj: any = {
            level: 0,
            key: new Uint8Array(0)
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1:
                obj.level = reader.uint32()
                break
              case 2:
                obj.key = reader.bytes()
                break
              default:
                reader.skipType(tag & 7)
                break
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

    export const decode = (buf: Uint8Array | Uint8ArrayList): GetNodeRequest => {
      return decodeMessage(buf, GetNodeRequest.codec())
    }
  }

  export interface GetChildrenRequest {
    level: number
    key: Uint8Array
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

          if ((obj.key != null && obj.key.byteLength > 0)) {
            w.uint32(18)
            w.bytes(obj.key)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length) => {
          const obj: any = {
            level: 0,
            key: new Uint8Array(0)
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1:
                obj.level = reader.uint32()
                break
              case 2:
                obj.key = reader.bytes()
                break
              default:
                reader.skipType(tag & 7)
                break
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

    export const decode = (buf: Uint8Array | Uint8ArrayList): GetChildrenRequest => {
      return decodeMessage(buf, GetChildrenRequest.codec())
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

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {}

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.getRoot = Request.GetRootRequest.codec().decode(reader, reader.uint32())
              break
            case 2:
              obj.getNode = Request.GetNodeRequest.codec().decode(reader, reader.uint32())
              break
            case 3:
              obj.getChildren = Request.GetChildrenRequest.codec().decode(reader, reader.uint32())
              break
            default:
              reader.skipType(tag & 7)
              break
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

  export const decode = (buf: Uint8Array | Uint8ArrayList): Request => {
    return decodeMessage(buf, Request.codec())
  }
}

export interface Response {
  getRoot?: Response.GetRootResponse
  getNode?: Response.GetNodeResponse
  getChildren?: Response.GetChildrenResponse
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
        }, (reader, length) => {
          const obj: any = {}

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1:
                obj.root = Node.codec().decode(reader, reader.uint32())
                break
              default:
                reader.skipType(tag & 7)
                break
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

    export const decode = (buf: Uint8Array | Uint8ArrayList): GetRootResponse => {
      return decodeMessage(buf, GetRootResponse.codec())
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
        }, (reader, length) => {
          const obj: any = {}

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1:
                obj.node = Node.codec().decode(reader, reader.uint32())
                break
              default:
                reader.skipType(tag & 7)
                break
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

    export const decode = (buf: Uint8Array | Uint8ArrayList): GetNodeResponse => {
      return decodeMessage(buf, GetNodeResponse.codec())
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
        }, (reader, length) => {
          const obj: any = {
            children: []
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1:
                obj.children.push(Node.codec().decode(reader, reader.uint32()))
                break
              default:
                reader.skipType(tag & 7)
                break
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

    export const decode = (buf: Uint8Array | Uint8ArrayList): GetChildrenResponse => {
      return decodeMessage(buf, GetChildrenResponse.codec())
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

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {}

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.getRoot = Response.GetRootResponse.codec().decode(reader, reader.uint32())
              break
            case 2:
              obj.getNode = Response.GetNodeResponse.codec().decode(reader, reader.uint32())
              break
            case 3:
              obj.getChildren = Response.GetChildrenResponse.codec().decode(reader, reader.uint32())
              break
            default:
              reader.skipType(tag & 7)
              break
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

  export const decode = (buf: Uint8Array | Uint8ArrayList): Response => {
    return decodeMessage(buf, Response.codec())
  }
}
