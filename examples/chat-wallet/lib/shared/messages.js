import { encodeMessage, decodeMessage, message } from 'protons-runtime';
export var SignedData;
(function (SignedData) {
    let _codec;
    SignedData.codec = () => {
        if (_codec == null) {
            _codec = message((obj, w, opts = {}) => {
                if (opts.lengthDelimited !== false) {
                    w.fork();
                }
                if ((obj.publicKey != null && obj.publicKey.byteLength > 0)) {
                    w.uint32(10);
                    w.bytes(obj.publicKey);
                }
                if ((obj.signature != null && obj.signature.byteLength > 0)) {
                    w.uint32(18);
                    w.bytes(obj.signature);
                }
                if ((obj.data != null && obj.data.byteLength > 0)) {
                    w.uint32(26);
                    w.bytes(obj.data);
                }
                if (opts.lengthDelimited !== false) {
                    w.ldelim();
                }
            }, (reader, length) => {
                const obj = {
                    publicKey: new Uint8Array(0),
                    signature: new Uint8Array(0),
                    data: new Uint8Array(0)
                };
                const end = length == null ? reader.len : reader.pos + length;
                while (reader.pos < end) {
                    const tag = reader.uint32();
                    switch (tag >>> 3) {
                        case 1:
                            obj.publicKey = reader.bytes();
                            break;
                        case 2:
                            obj.signature = reader.bytes();
                            break;
                        case 3:
                            obj.data = reader.bytes();
                            break;
                        default:
                            reader.skipType(tag & 7);
                            break;
                    }
                }
                return obj;
            });
        }
        return _codec;
    };
    SignedData.encode = (obj) => {
        return encodeMessage(obj, SignedData.codec());
    };
    SignedData.decode = (buf) => {
        return decodeMessage(buf, SignedData.codec());
    };
})(SignedData || (SignedData = {}));
export var EncryptedEvent;
(function (EncryptedEvent) {
    let Recipient;
    (function (Recipient) {
        let _codec;
        Recipient.codec = () => {
            if (_codec == null) {
                _codec = message((obj, w, opts = {}) => {
                    if (opts.lengthDelimited !== false) {
                        w.fork();
                    }
                    if ((obj.publicKey != null && obj.publicKey.byteLength > 0)) {
                        w.uint32(10);
                        w.bytes(obj.publicKey);
                    }
                    if ((obj.ciphertext != null && obj.ciphertext.byteLength > 0)) {
                        w.uint32(18);
                        w.bytes(obj.ciphertext);
                    }
                    if (opts.lengthDelimited !== false) {
                        w.ldelim();
                    }
                }, (reader, length) => {
                    const obj = {
                        publicKey: new Uint8Array(0),
                        ciphertext: new Uint8Array(0)
                    };
                    const end = length == null ? reader.len : reader.pos + length;
                    while (reader.pos < end) {
                        const tag = reader.uint32();
                        switch (tag >>> 3) {
                            case 1:
                                obj.publicKey = reader.bytes();
                                break;
                            case 2:
                                obj.ciphertext = reader.bytes();
                                break;
                            default:
                                reader.skipType(tag & 7);
                                break;
                        }
                    }
                    return obj;
                });
            }
            return _codec;
        };
        Recipient.encode = (obj) => {
            return encodeMessage(obj, Recipient.codec());
        };
        Recipient.decode = (buf) => {
            return decodeMessage(buf, Recipient.codec());
        };
    })(Recipient = EncryptedEvent.Recipient || (EncryptedEvent.Recipient = {}));
    let _codec;
    EncryptedEvent.codec = () => {
        if (_codec == null) {
            _codec = message((obj, w, opts = {}) => {
                if (opts.lengthDelimited !== false) {
                    w.fork();
                }
                if ((obj.senderAddress != null && obj.senderAddress.byteLength > 0)) {
                    w.uint32(10);
                    w.bytes(obj.senderAddress);
                }
                if ((obj.roomId != null && obj.roomId !== '')) {
                    w.uint32(18);
                    w.string(obj.roomId);
                }
                if ((obj.timestamp != null && obj.timestamp !== 0n)) {
                    w.uint32(24);
                    w.uint64(obj.timestamp);
                }
                if ((obj.nonce != null && obj.nonce.byteLength > 0)) {
                    w.uint32(34);
                    w.bytes(obj.nonce);
                }
                if ((obj.commitment != null && obj.commitment.byteLength > 0)) {
                    w.uint32(42);
                    w.bytes(obj.commitment);
                }
                if (obj.recipients != null) {
                    for (const value of obj.recipients) {
                        w.uint32(50);
                        EncryptedEvent.Recipient.codec().encode(value, w);
                    }
                }
                if (opts.lengthDelimited !== false) {
                    w.ldelim();
                }
            }, (reader, length) => {
                const obj = {
                    senderAddress: new Uint8Array(0),
                    roomId: '',
                    timestamp: 0n,
                    nonce: new Uint8Array(0),
                    commitment: new Uint8Array(0),
                    recipients: []
                };
                const end = length == null ? reader.len : reader.pos + length;
                while (reader.pos < end) {
                    const tag = reader.uint32();
                    switch (tag >>> 3) {
                        case 1:
                            obj.senderAddress = reader.bytes();
                            break;
                        case 2:
                            obj.roomId = reader.string();
                            break;
                        case 3:
                            obj.timestamp = reader.uint64();
                            break;
                        case 4:
                            obj.nonce = reader.bytes();
                            break;
                        case 5:
                            obj.commitment = reader.bytes();
                            break;
                        case 6:
                            obj.recipients.push(EncryptedEvent.Recipient.codec().decode(reader, reader.uint32()));
                            break;
                        default:
                            reader.skipType(tag & 7);
                            break;
                    }
                }
                return obj;
            });
        }
        return _codec;
    };
    EncryptedEvent.encode = (obj) => {
        return encodeMessage(obj, EncryptedEvent.codec());
    };
    EncryptedEvent.decode = (buf) => {
        return decodeMessage(buf, EncryptedEvent.codec());
    };
})(EncryptedEvent || (EncryptedEvent = {}));
export var SignedUserRegistration;
(function (SignedUserRegistration) {
    let KeyBundle;
    (function (KeyBundle) {
        let _codec;
        KeyBundle.codec = () => {
            if (_codec == null) {
                _codec = message((obj, w, opts = {}) => {
                    if (opts.lengthDelimited !== false) {
                        w.fork();
                    }
                    if ((obj.signingPublicKey != null && obj.signingPublicKey.byteLength > 0)) {
                        w.uint32(10);
                        w.bytes(obj.signingPublicKey);
                    }
                    if ((obj.encryptionPublicKey != null && obj.encryptionPublicKey.byteLength > 0)) {
                        w.uint32(18);
                        w.bytes(obj.encryptionPublicKey);
                    }
                    if (opts.lengthDelimited !== false) {
                        w.ldelim();
                    }
                }, (reader, length) => {
                    const obj = {
                        signingPublicKey: new Uint8Array(0),
                        encryptionPublicKey: new Uint8Array(0)
                    };
                    const end = length == null ? reader.len : reader.pos + length;
                    while (reader.pos < end) {
                        const tag = reader.uint32();
                        switch (tag >>> 3) {
                            case 1:
                                obj.signingPublicKey = reader.bytes();
                                break;
                            case 2:
                                obj.encryptionPublicKey = reader.bytes();
                                break;
                            default:
                                reader.skipType(tag & 7);
                                break;
                        }
                    }
                    return obj;
                });
            }
            return _codec;
        };
        KeyBundle.encode = (obj) => {
            return encodeMessage(obj, KeyBundle.codec());
        };
        KeyBundle.decode = (buf) => {
            return decodeMessage(buf, KeyBundle.codec());
        };
    })(KeyBundle = SignedUserRegistration.KeyBundle || (SignedUserRegistration.KeyBundle = {}));
    let _codec;
    SignedUserRegistration.codec = () => {
        if (_codec == null) {
            _codec = message((obj, w, opts = {}) => {
                if (opts.lengthDelimited !== false) {
                    w.fork();
                }
                if ((obj.signature != null && obj.signature.byteLength > 0)) {
                    w.uint32(10);
                    w.bytes(obj.signature);
                }
                if ((obj.address != null && obj.address.byteLength > 0)) {
                    w.uint32(18);
                    w.bytes(obj.address);
                }
                if (obj.keyBundle != null) {
                    w.uint32(26);
                    SignedUserRegistration.KeyBundle.codec().encode(obj.keyBundle, w);
                }
                if (opts.lengthDelimited !== false) {
                    w.ldelim();
                }
            }, (reader, length) => {
                const obj = {
                    signature: new Uint8Array(0),
                    address: new Uint8Array(0)
                };
                const end = length == null ? reader.len : reader.pos + length;
                while (reader.pos < end) {
                    const tag = reader.uint32();
                    switch (tag >>> 3) {
                        case 1:
                            obj.signature = reader.bytes();
                            break;
                        case 2:
                            obj.address = reader.bytes();
                            break;
                        case 3:
                            obj.keyBundle = SignedUserRegistration.KeyBundle.codec().decode(reader, reader.uint32());
                            break;
                        default:
                            reader.skipType(tag & 7);
                            break;
                    }
                }
                return obj;
            });
        }
        return _codec;
    };
    SignedUserRegistration.encode = (obj) => {
        return encodeMessage(obj, SignedUserRegistration.codec());
    };
    SignedUserRegistration.decode = (buf) => {
        return decodeMessage(buf, SignedUserRegistration.codec());
    };
})(SignedUserRegistration || (SignedUserRegistration = {}));
export var RoomRegistration;
(function (RoomRegistration) {
    let _codec;
    RoomRegistration.codec = () => {
        if (_codec == null) {
            _codec = message((obj, w, opts = {}) => {
                if (opts.lengthDelimited !== false) {
                    w.fork();
                }
                if ((obj.creatorAddress != null && obj.creatorAddress.byteLength > 0)) {
                    w.uint32(10);
                    w.bytes(obj.creatorAddress);
                }
                if ((obj.timestamp != null && obj.timestamp !== 0n)) {
                    w.uint32(16);
                    w.uint64(obj.timestamp);
                }
                if (obj.members != null) {
                    for (const value of obj.members) {
                        w.uint32(26);
                        SignedUserRegistration.codec().encode(value, w);
                    }
                }
                if (opts.lengthDelimited !== false) {
                    w.ldelim();
                }
            }, (reader, length) => {
                const obj = {
                    creatorAddress: new Uint8Array(0),
                    timestamp: 0n,
                    members: []
                };
                const end = length == null ? reader.len : reader.pos + length;
                while (reader.pos < end) {
                    const tag = reader.uint32();
                    switch (tag >>> 3) {
                        case 1:
                            obj.creatorAddress = reader.bytes();
                            break;
                        case 2:
                            obj.timestamp = reader.uint64();
                            break;
                        case 3:
                            obj.members.push(SignedUserRegistration.codec().decode(reader, reader.uint32()));
                            break;
                        default:
                            reader.skipType(tag & 7);
                            break;
                    }
                }
                return obj;
            });
        }
        return _codec;
    };
    RoomRegistration.encode = (obj) => {
        return encodeMessage(obj, RoomRegistration.codec());
    };
    RoomRegistration.decode = (buf) => {
        return decodeMessage(buf, RoomRegistration.codec());
    };
})(RoomRegistration || (RoomRegistration = {}));
