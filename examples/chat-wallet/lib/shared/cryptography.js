import nacl from "tweetnacl";
import { getAddress, bytesToHex, hexToBytes, keccak256, recoverTypedDataAddress } from "viem/utils";
import { blake3 } from "@noble/hashes/blake3";
import { equals } from "uint8arrays";
import { base58btc } from "multiformats/bases/base58";
import * as Messages from "./messages.js";
import { assert } from "./utils.js";
const buildMagicString = (pin) => `[Password: ${pin}]

Generate a new messaging key?

Signing this message will allow the application to read & write messages from your address.

Only do this when setting up your messaging client or mobile application.`;
function constructTypedKeyBundle(keyBundle) {
    const types = {
        EIP712Domain: [{ name: "name", type: "string" }],
        KeyBundle: [
            { name: "signingPublicKey", type: "bytes" },
            { name: "encryptionPublicKey", type: "bytes" },
        ],
    };
    return {
        types,
        primaryType: "KeyBundle",
        domain: { name: "InterwalletChat" },
        message: keyBundle,
    };
}
async function verifyKeyBundle(signedUserRegistration) {
    assert(signedUserRegistration.keyBundle, "missing keyBundle");
    assert(signedUserRegistration.keyBundle.signingPublicKey, "missing keyBundle.signingPublicKey");
    assert(signedUserRegistration.keyBundle.encryptionPublicKey, "missing keyBundle.encryptionPublicKey");
    const keyBundle = {
        signingPublicKey: bytesToHex(signedUserRegistration.keyBundle.signingPublicKey),
        encryptionPublicKey: bytesToHex(signedUserRegistration.keyBundle.encryptionPublicKey),
    };
    const typedKeyBundle = constructTypedKeyBundle(keyBundle);
    const keyBundleSignature = bytesToHex(signedUserRegistration.signature);
    const address = await recoverTypedDataAddress({
        ...typedKeyBundle,
        signature: keyBundleSignature,
    });
    assert(equals(hexToBytes(address), signedUserRegistration.address), "invalid signature");
    return { address, keyBundle, keyBundleSignature };
}
export const createPrivateUserRegistration = async (walletClient, account, pin) => {
    const magicString = buildMagicString(pin);
    const signature = await walletClient.signMessage({ account, message: magicString });
    const privateKey = keccak256(signature);
    const encryptionKeyPair = nacl.box.keyPair.fromSecretKey(hexToBytes(privateKey));
    const signingKeyPair = nacl.sign.keyPair.fromSeed(hexToBytes(privateKey));
    const keyBundle = {
        encryptionPublicKey: bytesToHex(encryptionKeyPair.publicKey),
        signingPublicKey: bytesToHex(signingKeyPair.publicKey),
    };
    const typedKeyBundle = constructTypedKeyBundle(keyBundle);
    const keyBundleSignature = await walletClient.signTypedData({ account, ...typedKeyBundle });
    return {
        address: getAddress(account),
        keyBundleSignature,
        keyBundle,
        encryptionPrivateKey: privateKey,
        signingPrivateKey: bytesToHex(signingKeyPair.secretKey),
    };
};
export const getRoomId = (key) => base58btc.baseEncode(key);
export async function validateRoomRegistration(key, value) {
    const { signature, data: signedData } = Messages.SignedData.decode(value);
    const roomRegistration = Messages.RoomRegistration.decode(signedData);
    assert(roomRegistration.members.length === 2, "rooms must have exactly two members");
    const hash = blake3.create({ dkLen: 16 });
    for (const member of roomRegistration.members) {
        assert(member.address, "missing member.address");
        hash.update(member.address);
    }
    assert(equals(key, hash.digest()), "invalid room registration key");
    let creator = null;
    const members = [];
    for (const member of roomRegistration.members) {
        const memberRegistration = await verifyKeyBundle(member);
        members.push(memberRegistration);
        if (equals(member.address, roomRegistration.creator)) {
            creator = memberRegistration;
        }
    }
    assert(creator !== null, "room creator must be a member of the room");
    assert(nacl.sign.detached.verify(signedData, signature, hexToBytes(creator.keyBundle.signingPublicKey)), "invalid room registration signature");
    const id = getRoomId(key);
    return { id, creator: creator.address, members };
}
export async function validateUserRegistration(key, value) {
    const signedUserRegistration = Messages.SignedUserRegistration.decode(value);
    const userRegistration = await verifyKeyBundle(signedUserRegistration);
    assert(equals(key, hexToBytes(userRegistration.address)), "invalid user registration: key is not the bytes of the address");
    return userRegistration;
}
export function validateEvent(room, key, value) {
    assert(equals(key, blake3(value, { dkLen: 16 })), "invalid event: key is not hash of value");
    const { signature, data: signedData } = Messages.SignedData.decode(value);
    const encryptedEvent = Messages.EncryptedEvent.decode(signedData);
    assert(getRoomId(encryptedEvent.roomId) === room.id, "event is for a different room");
    const senderAddress = getAddress(bytesToHex(encryptedEvent.userAddress));
    const sender = room.members.find((member) => member.address === senderAddress);
    assert(sender !== undefined, "sender is not a member of the room");
    assert(nacl.sign.detached.verify(signedData, signature, hexToBytes(sender.keyBundle.signingPublicKey)), "invalid event signature");
    const recipientPublicKey = bytesToHex(encryptedEvent.publicKey);
    const recipient = room.members.find((member) => member.keyBundle.encryptionPublicKey === recipientPublicKey);
    assert(recipient !== undefined, "recipient is not a member of the room");
    return { encryptedEvent, sender, recipient };
}
