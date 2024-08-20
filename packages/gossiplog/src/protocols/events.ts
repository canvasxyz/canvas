/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { type Codec, decodeMessage, type DecodeOptions, encodeMessage, MaxLengthError, message } from 'protons-runtime'
import { alloc as uint8ArrayAlloc } from 'uint8arrays/alloc'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface Event {
  insert?: Event.Insert
  update?: Event.Update
}

export namespace Event {
  export interface Insert {
    key: Uint8Array
    value: Uint8Array
  }

  export namespace Insert {
    let _codec: Codec<Insert>

    export const codec = (): Codec<Insert> => {
      if (_codec == null) {
        _codec = message<Insert>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if ((obj.key != null && obj.key.byteLength > 0)) {
            w.uint32(10)
            w.bytes(obj.key)
          }

          if ((obj.value != null && obj.value.byteLength > 0)) {
            w.uint32(18)
            w.bytes(obj.value)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length, opts = {}) => {
          const obj: any = {
            key: uint8ArrayAlloc(0),
            value: uint8ArrayAlloc(0)
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1: {
                obj.key = reader.bytes()
                break
              }
              case 2: {
                obj.value = reader.bytes()
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

    export const encode = (obj: Partial<Insert>): Uint8Array => {
      return encodeMessage(obj, Insert.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<Insert>): Insert => {
      return decodeMessage(buf, Insert.codec(), opts)
    }
  }

  export interface Update {
    heads: Uint8Array[]
  }

  export namespace Update {
    let _codec: Codec<Update>

    export const codec = (): Codec<Update> => {
      if (_codec == null) {
        _codec = message<Update>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if (obj.heads != null) {
            for (const value of obj.heads) {
              w.uint32(10)
              w.bytes(value)
            }
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length, opts = {}) => {
          const obj: any = {
            heads: []
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1: {
                if (opts.limits?.heads != null && obj.heads.length === opts.limits.heads) {
                  throw new MaxLengthError('Decode error - map field "heads" had too many elements')
                }

                obj.heads.push(reader.bytes())
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

    export const encode = (obj: Partial<Update>): Uint8Array => {
      return encodeMessage(obj, Update.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<Update>): Update => {
      return decodeMessage(buf, Update.codec(), opts)
    }
  }

  let _codec: Codec<Event>

  export const codec = (): Codec<Event> => {
    if (_codec == null) {
      _codec = message<Event>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.insert != null) {
          w.uint32(10)
          Event.Insert.codec().encode(obj.insert, w)
        }

        if (obj.update != null) {
          w.uint32(18)
          Event.Update.codec().encode(obj.update, w)
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
              obj.insert = Event.Insert.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.insert
              })
              break
            }
            case 2: {
              obj.update = Event.Update.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.update
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

  export const encode = (obj: Partial<Event>): Uint8Array => {
    return encodeMessage(obj, Event.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<Event>): Event => {
    return decodeMessage(buf, Event.codec(), opts)
  }
}
