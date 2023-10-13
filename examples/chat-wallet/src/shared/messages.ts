/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { encodeMessage, decodeMessage, message } from 'protons-runtime'
import type { Codec } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface SignedData {
  publicKey: Uint8Array
  signature: Uint8Array
  data: Uint8Array
}

export namespace SignedData {
  let _codec: Codec<SignedData>

  export const codec = (): Codec<SignedData> => {
    if (_codec == null) {
      _codec = message<SignedData>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.publicKey != null && obj.publicKey.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.publicKey)
        }

        if ((obj.signature != null && obj.signature.byteLength > 0)) {
          w.uint32(18)
          w.bytes(obj.signature)
        }

        if ((obj.data != null && obj.data.byteLength > 0)) {
          w.uint32(26)
          w.bytes(obj.data)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          publicKey: new Uint8Array(0),
          signature: new Uint8Array(0),
          data: new Uint8Array(0)
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.publicKey = reader.bytes()
              break
            case 2:
              obj.signature = reader.bytes()
              break
            case 3:
              obj.data = reader.bytes()
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

  export const encode = (obj: Partial<SignedData>): Uint8Array => {
    return encodeMessage(obj, SignedData.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): SignedData => {
    return decodeMessage(buf, SignedData.codec())
  }
}

export interface EncryptedEvent {
  senderAddress: Uint8Array
  roomId: string
  timestamp: bigint
  nonce: Uint8Array
  commitment: Uint8Array
  recipients: EncryptedEvent.Recipient[]
}

export namespace EncryptedEvent {
  export interface Recipient {
    publicKey: Uint8Array
    ciphertext: Uint8Array
  }

  export namespace Recipient {
    let _codec: Codec<Recipient>

    export const codec = (): Codec<Recipient> => {
      if (_codec == null) {
        _codec = message<Recipient>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if ((obj.publicKey != null && obj.publicKey.byteLength > 0)) {
            w.uint32(10)
            w.bytes(obj.publicKey)
          }

          if ((obj.ciphertext != null && obj.ciphertext.byteLength > 0)) {
            w.uint32(18)
            w.bytes(obj.ciphertext)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length) => {
          const obj: any = {
            publicKey: new Uint8Array(0),
            ciphertext: new Uint8Array(0)
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1:
                obj.publicKey = reader.bytes()
                break
              case 2:
                obj.ciphertext = reader.bytes()
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

    export const encode = (obj: Partial<Recipient>): Uint8Array => {
      return encodeMessage(obj, Recipient.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList): Recipient => {
      return decodeMessage(buf, Recipient.codec())
    }
  }

  let _codec: Codec<EncryptedEvent>

  export const codec = (): Codec<EncryptedEvent> => {
    if (_codec == null) {
      _codec = message<EncryptedEvent>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.senderAddress != null && obj.senderAddress.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.senderAddress)
        }

        if ((obj.roomId != null && obj.roomId !== '')) {
          w.uint32(18)
          w.string(obj.roomId)
        }

        if ((obj.timestamp != null && obj.timestamp !== 0n)) {
          w.uint32(24)
          w.uint64(obj.timestamp)
        }

        if ((obj.nonce != null && obj.nonce.byteLength > 0)) {
          w.uint32(34)
          w.bytes(obj.nonce)
        }

        if ((obj.commitment != null && obj.commitment.byteLength > 0)) {
          w.uint32(42)
          w.bytes(obj.commitment)
        }

        if (obj.recipients != null) {
          for (const value of obj.recipients) {
            w.uint32(50)
            EncryptedEvent.Recipient.codec().encode(value, w)
          }
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          senderAddress: new Uint8Array(0),
          roomId: '',
          timestamp: 0n,
          nonce: new Uint8Array(0),
          commitment: new Uint8Array(0),
          recipients: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.senderAddress = reader.bytes()
              break
            case 2:
              obj.roomId = reader.string()
              break
            case 3:
              obj.timestamp = reader.uint64()
              break
            case 4:
              obj.nonce = reader.bytes()
              break
            case 5:
              obj.commitment = reader.bytes()
              break
            case 6:
              obj.recipients.push(EncryptedEvent.Recipient.codec().decode(reader, reader.uint32()))
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

  export const encode = (obj: Partial<EncryptedEvent>): Uint8Array => {
    return encodeMessage(obj, EncryptedEvent.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): EncryptedEvent => {
    return decodeMessage(buf, EncryptedEvent.codec())
  }
}

export interface SignedUserRegistration {
  signature: Uint8Array
  address: Uint8Array
  keyBundle?: SignedUserRegistration.KeyBundle
}

export namespace SignedUserRegistration {
  export interface KeyBundle {
    signingPublicKey: Uint8Array
    encryptionPublicKey: Uint8Array
  }

  export namespace KeyBundle {
    let _codec: Codec<KeyBundle>

    export const codec = (): Codec<KeyBundle> => {
      if (_codec == null) {
        _codec = message<KeyBundle>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if ((obj.signingPublicKey != null && obj.signingPublicKey.byteLength > 0)) {
            w.uint32(10)
            w.bytes(obj.signingPublicKey)
          }

          if ((obj.encryptionPublicKey != null && obj.encryptionPublicKey.byteLength > 0)) {
            w.uint32(18)
            w.bytes(obj.encryptionPublicKey)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length) => {
          const obj: any = {
            signingPublicKey: new Uint8Array(0),
            encryptionPublicKey: new Uint8Array(0)
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1:
                obj.signingPublicKey = reader.bytes()
                break
              case 2:
                obj.encryptionPublicKey = reader.bytes()
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

    export const encode = (obj: Partial<KeyBundle>): Uint8Array => {
      return encodeMessage(obj, KeyBundle.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList): KeyBundle => {
      return decodeMessage(buf, KeyBundle.codec())
    }
  }

  let _codec: Codec<SignedUserRegistration>

  export const codec = (): Codec<SignedUserRegistration> => {
    if (_codec == null) {
      _codec = message<SignedUserRegistration>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.signature != null && obj.signature.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.signature)
        }

        if ((obj.address != null && obj.address.byteLength > 0)) {
          w.uint32(18)
          w.bytes(obj.address)
        }

        if (obj.keyBundle != null) {
          w.uint32(26)
          SignedUserRegistration.KeyBundle.codec().encode(obj.keyBundle, w)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          signature: new Uint8Array(0),
          address: new Uint8Array(0)
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.signature = reader.bytes()
              break
            case 2:
              obj.address = reader.bytes()
              break
            case 3:
              obj.keyBundle = SignedUserRegistration.KeyBundle.codec().decode(reader, reader.uint32())
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

  export const encode = (obj: Partial<SignedUserRegistration>): Uint8Array => {
    return encodeMessage(obj, SignedUserRegistration.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): SignedUserRegistration => {
    return decodeMessage(buf, SignedUserRegistration.codec())
  }
}

export interface RoomRegistration {
  creatorAddress: Uint8Array
  timestamp: bigint
  members: SignedUserRegistration[]
}

export namespace RoomRegistration {
  let _codec: Codec<RoomRegistration>

  export const codec = (): Codec<RoomRegistration> => {
    if (_codec == null) {
      _codec = message<RoomRegistration>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.creatorAddress != null && obj.creatorAddress.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.creatorAddress)
        }

        if ((obj.timestamp != null && obj.timestamp !== 0n)) {
          w.uint32(16)
          w.uint64(obj.timestamp)
        }

        if (obj.members != null) {
          for (const value of obj.members) {
            w.uint32(26)
            SignedUserRegistration.codec().encode(value, w)
          }
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          creatorAddress: new Uint8Array(0),
          timestamp: 0n,
          members: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.creatorAddress = reader.bytes()
              break
            case 2:
              obj.timestamp = reader.uint64()
              break
            case 3:
              obj.members.push(SignedUserRegistration.codec().decode(reader, reader.uint32()))
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

  export const encode = (obj: Partial<RoomRegistration>): Uint8Array => {
    return encodeMessage(obj, RoomRegistration.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): RoomRegistration => {
    return decodeMessage(buf, RoomRegistration.codec())
  }
}
