/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { encodeMessage, decodeMessage, message } from 'protons-runtime'
import type { Codec } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface SignedData {
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

        if ((obj.signature != null && obj.signature.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.signature)
        }

        if ((obj.data != null && obj.data.byteLength > 0)) {
          w.uint32(18)
          w.bytes(obj.data)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          signature: new Uint8Array(0),
          data: new Uint8Array(0)
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.signature = reader.bytes()
              break
            case 2:
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

export interface EncryptedPayload {
  publicKey: Uint8Array
  ciphertext: Uint8Array
  nonce: Uint8Array
}

export namespace EncryptedPayload {
  let _codec: Codec<EncryptedPayload>

  export const codec = (): Codec<EncryptedPayload> => {
    if (_codec == null) {
      _codec = message<EncryptedPayload>((obj, w, opts = {}) => {
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

        if ((obj.nonce != null && obj.nonce.byteLength > 0)) {
          w.uint32(26)
          w.bytes(obj.nonce)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          publicKey: new Uint8Array(0),
          ciphertext: new Uint8Array(0),
          nonce: new Uint8Array(0)
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
            case 3:
              obj.nonce = reader.bytes()
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

  export const encode = (obj: Partial<EncryptedPayload>): Uint8Array => {
    return encodeMessage(obj, EncryptedPayload.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): EncryptedPayload => {
    return decodeMessage(buf, EncryptedPayload.codec())
  }
}

export interface EncryptedEvent {
  roomId: Uint8Array
  userAddress: Uint8Array
  recipients: EncryptedPayload[]
}

export namespace EncryptedEvent {
  let _codec: Codec<EncryptedEvent>

  export const codec = (): Codec<EncryptedEvent> => {
    if (_codec == null) {
      _codec = message<EncryptedEvent>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.roomId != null && obj.roomId.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.roomId)
        }

        if ((obj.userAddress != null && obj.userAddress.byteLength > 0)) {
          w.uint32(18)
          w.bytes(obj.userAddress)
        }

        if (obj.recipients != null) {
          for (const value of obj.recipients) {
            w.uint32(26)
            EncryptedPayload.codec().encode(value, w)
          }
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          roomId: new Uint8Array(0),
          userAddress: new Uint8Array(0),
          recipients: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.roomId = reader.bytes()
              break
            case 2:
              obj.userAddress = reader.bytes()
              break
            case 3:
              obj.recipients.push(EncryptedPayload.codec().decode(reader, reader.uint32()))
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
  creator: Uint8Array
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

        if ((obj.creator != null && obj.creator.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.creator)
        }

        if (obj.members != null) {
          for (const value of obj.members) {
            w.uint32(18)
            SignedUserRegistration.codec().encode(value, w)
          }
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          creator: new Uint8Array(0),
          members: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.creator = reader.bytes()
              break
            case 2:
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
