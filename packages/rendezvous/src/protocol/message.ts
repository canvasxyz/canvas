/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { type Codec, decodeMessage, type DecodeOptions, encodeMessage, enumeration, MaxLengthError, message } from 'protons-runtime'
import { alloc as uint8ArrayAlloc } from 'uint8arrays/alloc'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface Message {
  type: Message.MessageType
  register?: Message.Register
  registerResponse?: Message.RegisterResponse
  unregister?: Message.Unregister
  discover?: Message.Discover
  discoverResponse?: Message.DiscoverResponse
}

export namespace Message {
  export enum MessageType {
    REGISTER = 'REGISTER',
    REGISTER_RESPONSE = 'REGISTER_RESPONSE',
    UNREGISTER = 'UNREGISTER',
    DISCOVER = 'DISCOVER',
    DISCOVER_RESPONSE = 'DISCOVER_RESPONSE'
  }

  enum __MessageTypeValues {
    REGISTER = 0,
    REGISTER_RESPONSE = 1,
    UNREGISTER = 2,
    DISCOVER = 3,
    DISCOVER_RESPONSE = 4
  }

  export namespace MessageType {
    export const codec = (): Codec<MessageType> => {
      return enumeration<MessageType>(__MessageTypeValues)
    }
  }

  export enum ResponseStatus {
    OK = 'OK',
    E_INVALID_NAMESPACE = 'E_INVALID_NAMESPACE',
    E_INVALID_SIGNED_PEER_RECORD = 'E_INVALID_SIGNED_PEER_RECORD',
    E_INVALID_TTL = 'E_INVALID_TTL',
    E_INVALID_COOKIE = 'E_INVALID_COOKIE',
    E_NOT_AUTHORIZED = 'E_NOT_AUTHORIZED',
    E_INTERNAL_ERROR = 'E_INTERNAL_ERROR',
    E_UNAVAILABLE = 'E_UNAVAILABLE'
  }

  enum __ResponseStatusValues {
    OK = 0,
    E_INVALID_NAMESPACE = 100,
    E_INVALID_SIGNED_PEER_RECORD = 101,
    E_INVALID_TTL = 102,
    E_INVALID_COOKIE = 103,
    E_NOT_AUTHORIZED = 200,
    E_INTERNAL_ERROR = 300,
    E_UNAVAILABLE = 400
  }

  export namespace ResponseStatus {
    export const codec = (): Codec<ResponseStatus> => {
      return enumeration<ResponseStatus>(__ResponseStatusValues)
    }
  }

  export interface Register {
    ns: string
    signedPeerRecord: Uint8Array
    ttl: bigint
  }

  export namespace Register {
    let _codec: Codec<Register>

    export const codec = (): Codec<Register> => {
      if (_codec == null) {
        _codec = message<Register>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if ((obj.ns != null && obj.ns !== '')) {
            w.uint32(10)
            w.string(obj.ns)
          }

          if ((obj.signedPeerRecord != null && obj.signedPeerRecord.byteLength > 0)) {
            w.uint32(18)
            w.bytes(obj.signedPeerRecord)
          }

          if ((obj.ttl != null && obj.ttl !== 0n)) {
            w.uint32(24)
            w.uint64(obj.ttl)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length, opts = {}) => {
          const obj: any = {
            ns: '',
            signedPeerRecord: uint8ArrayAlloc(0),
            ttl: 0n
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1: {
                obj.ns = reader.string()
                break
              }
              case 2: {
                obj.signedPeerRecord = reader.bytes()
                break
              }
              case 3: {
                obj.ttl = reader.uint64()
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

    export const encode = (obj: Partial<Register>): Uint8Array => {
      return encodeMessage(obj, Register.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<Register>): Register => {
      return decodeMessage(buf, Register.codec(), opts)
    }
  }

  export interface RegisterResponse {
    status: Message.ResponseStatus
    statusText: string
    ttl: bigint
  }

  export namespace RegisterResponse {
    let _codec: Codec<RegisterResponse>

    export const codec = (): Codec<RegisterResponse> => {
      if (_codec == null) {
        _codec = message<RegisterResponse>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if (obj.status != null && __ResponseStatusValues[obj.status] !== 0) {
            w.uint32(8)
            Message.ResponseStatus.codec().encode(obj.status, w)
          }

          if ((obj.statusText != null && obj.statusText !== '')) {
            w.uint32(18)
            w.string(obj.statusText)
          }

          if ((obj.ttl != null && obj.ttl !== 0n)) {
            w.uint32(24)
            w.uint64(obj.ttl)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length, opts = {}) => {
          const obj: any = {
            status: ResponseStatus.OK,
            statusText: '',
            ttl: 0n
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1: {
                obj.status = Message.ResponseStatus.codec().decode(reader)
                break
              }
              case 2: {
                obj.statusText = reader.string()
                break
              }
              case 3: {
                obj.ttl = reader.uint64()
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

    export const encode = (obj: Partial<RegisterResponse>): Uint8Array => {
      return encodeMessage(obj, RegisterResponse.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<RegisterResponse>): RegisterResponse => {
      return decodeMessage(buf, RegisterResponse.codec(), opts)
    }
  }

  export interface Unregister {
    ns: string
  }

  export namespace Unregister {
    let _codec: Codec<Unregister>

    export const codec = (): Codec<Unregister> => {
      if (_codec == null) {
        _codec = message<Unregister>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if ((obj.ns != null && obj.ns !== '')) {
            w.uint32(10)
            w.string(obj.ns)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length, opts = {}) => {
          const obj: any = {
            ns: ''
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1: {
                obj.ns = reader.string()
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

    export const encode = (obj: Partial<Unregister>): Uint8Array => {
      return encodeMessage(obj, Unregister.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<Unregister>): Unregister => {
      return decodeMessage(buf, Unregister.codec(), opts)
    }
  }

  export interface Discover {
    ns: string
    limit: bigint
    cookie: Uint8Array
  }

  export namespace Discover {
    let _codec: Codec<Discover>

    export const codec = (): Codec<Discover> => {
      if (_codec == null) {
        _codec = message<Discover>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if ((obj.ns != null && obj.ns !== '')) {
            w.uint32(10)
            w.string(obj.ns)
          }

          if ((obj.limit != null && obj.limit !== 0n)) {
            w.uint32(16)
            w.uint64(obj.limit)
          }

          if ((obj.cookie != null && obj.cookie.byteLength > 0)) {
            w.uint32(26)
            w.bytes(obj.cookie)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length, opts = {}) => {
          const obj: any = {
            ns: '',
            limit: 0n,
            cookie: uint8ArrayAlloc(0)
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1: {
                obj.ns = reader.string()
                break
              }
              case 2: {
                obj.limit = reader.uint64()
                break
              }
              case 3: {
                obj.cookie = reader.bytes()
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

    export const encode = (obj: Partial<Discover>): Uint8Array => {
      return encodeMessage(obj, Discover.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<Discover>): Discover => {
      return decodeMessage(buf, Discover.codec(), opts)
    }
  }

  export interface DiscoverResponse {
    registrations: Message.Register[]
    cookie: Uint8Array
    status: Message.ResponseStatus
    statusText: string
  }

  export namespace DiscoverResponse {
    let _codec: Codec<DiscoverResponse>

    export const codec = (): Codec<DiscoverResponse> => {
      if (_codec == null) {
        _codec = message<DiscoverResponse>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if (obj.registrations != null) {
            for (const value of obj.registrations) {
              w.uint32(10)
              Message.Register.codec().encode(value, w)
            }
          }

          if ((obj.cookie != null && obj.cookie.byteLength > 0)) {
            w.uint32(18)
            w.bytes(obj.cookie)
          }

          if (obj.status != null && __ResponseStatusValues[obj.status] !== 0) {
            w.uint32(24)
            Message.ResponseStatus.codec().encode(obj.status, w)
          }

          if ((obj.statusText != null && obj.statusText !== '')) {
            w.uint32(34)
            w.string(obj.statusText)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length, opts = {}) => {
          const obj: any = {
            registrations: [],
            cookie: uint8ArrayAlloc(0),
            status: ResponseStatus.OK,
            statusText: ''
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1: {
                if (opts.limits?.registrations != null && obj.registrations.length === opts.limits.registrations) {
                  throw new MaxLengthError('Decode error - map field "registrations" had too many elements')
                }

                obj.registrations.push(Message.Register.codec().decode(reader, reader.uint32(), {
                  limits: opts.limits?.registrations$
                }))
                break
              }
              case 2: {
                obj.cookie = reader.bytes()
                break
              }
              case 3: {
                obj.status = Message.ResponseStatus.codec().decode(reader)
                break
              }
              case 4: {
                obj.statusText = reader.string()
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

    export const encode = (obj: Partial<DiscoverResponse>): Uint8Array => {
      return encodeMessage(obj, DiscoverResponse.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<DiscoverResponse>): DiscoverResponse => {
      return decodeMessage(buf, DiscoverResponse.codec(), opts)
    }
  }

  let _codec: Codec<Message>

  export const codec = (): Codec<Message> => {
    if (_codec == null) {
      _codec = message<Message>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.type != null && __MessageTypeValues[obj.type] !== 0) {
          w.uint32(8)
          Message.MessageType.codec().encode(obj.type, w)
        }

        if (obj.register != null) {
          w.uint32(18)
          Message.Register.codec().encode(obj.register, w)
        }

        if (obj.registerResponse != null) {
          w.uint32(26)
          Message.RegisterResponse.codec().encode(obj.registerResponse, w)
        }

        if (obj.unregister != null) {
          w.uint32(34)
          Message.Unregister.codec().encode(obj.unregister, w)
        }

        if (obj.discover != null) {
          w.uint32(42)
          Message.Discover.codec().encode(obj.discover, w)
        }

        if (obj.discoverResponse != null) {
          w.uint32(50)
          Message.DiscoverResponse.codec().encode(obj.discoverResponse, w)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          type: MessageType.REGISTER
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.type = Message.MessageType.codec().decode(reader)
              break
            }
            case 2: {
              obj.register = Message.Register.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.register
              })
              break
            }
            case 3: {
              obj.registerResponse = Message.RegisterResponse.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.registerResponse
              })
              break
            }
            case 4: {
              obj.unregister = Message.Unregister.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.unregister
              })
              break
            }
            case 5: {
              obj.discover = Message.Discover.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.discover
              })
              break
            }
            case 6: {
              obj.discoverResponse = Message.DiscoverResponse.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.discoverResponse
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

  export const encode = (obj: Partial<Message>): Uint8Array => {
    return encodeMessage(obj, Message.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<Message>): Message => {
    return decodeMessage(buf, Message.codec(), opts)
  }
}
