/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { encodeMessage, decodeMessage, message } from 'protons-runtime'
import type { Codec } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface Record {
  addrs: Uint8Array[]
  protocols: string[]
}

export namespace Record {
  let _codec: Codec<Record>

  export const codec = (): Codec<Record> => {
    if (_codec == null) {
      _codec = message<Record>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.addrs != null) {
          for (const value of obj.addrs) {
            w.uint32(18)
            w.bytes(value)
          }
        }

        if (obj.protocols != null) {
          for (const value of obj.protocols) {
            w.uint32(26)
            w.string(value)
          }
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          addrs: [],
          protocols: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 2:
              obj.addrs.push(reader.bytes())
              break
            case 3:
              obj.protocols.push(reader.string())
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

  export const encode = (obj: Partial<Record>): Uint8Array => {
    return encodeMessage(obj, Record.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): Record => {
    return decodeMessage(buf, Record.codec())
  }
}

export interface SignedRecord {
  from: Uint8Array
  data: Uint8Array
  seqno: Uint8Array
  topic: string
  signature: Uint8Array
  key: Uint8Array
}

export namespace SignedRecord {
  let _codec: Codec<SignedRecord>

  export const codec = (): Codec<SignedRecord> => {
    if (_codec == null) {
      _codec = message<SignedRecord>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.from != null && obj.from.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.from)
        }

        if ((obj.data != null && obj.data.byteLength > 0)) {
          w.uint32(18)
          w.bytes(obj.data)
        }

        if ((obj.seqno != null && obj.seqno.byteLength > 0)) {
          w.uint32(26)
          w.bytes(obj.seqno)
        }

        if ((obj.topic != null && obj.topic !== '')) {
          w.uint32(34)
          w.string(obj.topic)
        }

        if ((obj.signature != null && obj.signature.byteLength > 0)) {
          w.uint32(42)
          w.bytes(obj.signature)
        }

        if ((obj.key != null && obj.key.byteLength > 0)) {
          w.uint32(50)
          w.bytes(obj.key)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          from: new Uint8Array(0),
          data: new Uint8Array(0),
          seqno: new Uint8Array(0),
          topic: '',
          signature: new Uint8Array(0),
          key: new Uint8Array(0)
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.from = reader.bytes()
              break
            case 2:
              obj.data = reader.bytes()
              break
            case 3:
              obj.seqno = reader.bytes()
              break
            case 4:
              obj.topic = reader.string()
              break
            case 5:
              obj.signature = reader.bytes()
              break
            case 6:
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

  export const encode = (obj: Partial<SignedRecord>): Uint8Array => {
    return encodeMessage(obj, SignedRecord.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): SignedRecord => {
    return decodeMessage(buf, SignedRecord.codec())
  }
}

export interface QueryRequest {
  protocol: string
  limit: number
}

export namespace QueryRequest {
  let _codec: Codec<QueryRequest>

  export const codec = (): Codec<QueryRequest> => {
    if (_codec == null) {
      _codec = message<QueryRequest>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.protocol != null && obj.protocol !== '')) {
          w.uint32(10)
          w.string(obj.protocol)
        }

        if ((obj.limit != null && obj.limit !== 0)) {
          w.uint32(16)
          w.uint32(obj.limit)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          protocol: '',
          limit: 0
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.protocol = reader.string()
              break
            case 2:
              obj.limit = reader.uint32()
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

  export const encode = (obj: Partial<QueryRequest>): Uint8Array => {
    return encodeMessage(obj, QueryRequest.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): QueryRequest => {
    return decodeMessage(buf, QueryRequest.codec())
  }
}

export interface QueryResponse {
  records: SignedRecord[]
}

export namespace QueryResponse {
  let _codec: Codec<QueryResponse>

  export const codec = (): Codec<QueryResponse> => {
    if (_codec == null) {
      _codec = message<QueryResponse>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.records != null) {
          for (const value of obj.records) {
            w.uint32(10)
            SignedRecord.codec().encode(value, w)
          }
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          records: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.records.push(SignedRecord.codec().decode(reader, reader.uint32()))
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

  export const encode = (obj: Partial<QueryResponse>): Uint8Array => {
    return encodeMessage(obj, QueryResponse.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): QueryResponse => {
    return decodeMessage(buf, QueryResponse.codec())
  }
}
