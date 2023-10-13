import { getAddress, bytesToHex, hexToBytes, recoverTypedDataAddress } from "viem/utils";
import nacl from "tweetnacl";
import * as Messages from "./messages.js";
import { equals } from "uint8arrays";
export function assert(condition, message) {
    if (condition) {
        return;
    }
    else {
        throw new Error(message ?? "assertion error");
    }
}
export const getPublicUserRegistration = ({ encryptionPrivateKey, signingPrivateKey, ...user }) => user;
export function constructTypedKeyBundle(keyBundle) {
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
function decodeSignedData(value) {
    const { data, signature, publicKey } = Messages.SignedData.decode(value);
    assert(nacl.sign.detached.verify(data, signature, publicKey), "invalid signature");
    return { data, signature, publicKey };
}
function encodeSignedData(data, context) {
    const signature = nacl.sign.detached(data, hexToBytes(context.user.signingPrivateKey));
    return Messages.SignedData.encode({
        data,
        signature,
        publicKey: hexToBytes(context.user.keyBundle.signingPublicKey),
    });
}
async function validateUserRegistration(userRegistration) {
    const typedKeyBundle = constructTypedKeyBundle(userRegistration.keyBundle);
    const address = await recoverTypedDataAddress({
        ...typedKeyBundle,
        signature: userRegistration.keyBundleSignature,
    });
    assert(address === userRegistration.address, "invalid signature");
}
const serializeUser = (user) => ({
    address: hexToBytes(user.address),
    signature: hexToBytes(user.keyBundleSignature),
    keyBundle: {
        signingPublicKey: hexToBytes(user.keyBundle.signingPublicKey),
        encryptionPublicKey: hexToBytes(user.keyBundle.encryptionPublicKey),
    },
});
function parseUser({ address, signature, keyBundle }) {
    assert(keyBundle !== undefined, "user registration is missing key bundle");
    return {
        address: getAddress(bytesToHex(address)),
        keyBundleSignature: bytesToHex(signature),
        keyBundle: {
            signingPublicKey: bytesToHex(keyBundle.signingPublicKey),
            encryptionPublicKey: bytesToHex(keyBundle.encryptionPublicKey),
        },
    };
}
export async function decodeUserRegistration(value) {
    const userRegistration = parseUser(Messages.SignedUserRegistration.decode(value));
    await validateUserRegistration(userRegistration);
    return userRegistration;
}
export async function encodeUserRegistration(userRegistration) {
    await validateUserRegistration(userRegistration);
    return Messages.SignedUserRegistration.encode(serializeUser(userRegistration));
}
export async function encodeRoomRegistration(roomRegistration, context) {
    assert(context.user.address === roomRegistration.creator);
    for (const member of roomRegistration.members) {
        await validateUserRegistration(member);
    }
    const creatorAddress = hexToBytes(context.user.address);
    const members = roomRegistration.members.map(serializeUser);
    return encodeSignedData(Messages.RoomRegistration.encode({ creatorAddress, members }), context);
}
export async function decodeRoomRegistration(value) {
    const { data, publicKey } = decodeSignedData(value);
    const roomRegistration = Messages.RoomRegistration.decode(data);
    const creator = roomRegistration.members.find((member) => equals(roomRegistration.creatorAddress, member.address));
    assert(creator !== undefined, "room creator is not in members array");
    assert(creator.keyBundle !== undefined, "room creator is missing key bundle");
    assert(equals(publicKey, creator.keyBundle.signingPublicKey), "room creator did not sign the room registration");
    const creatorAddress = getAddress(bytesToHex(roomRegistration.creatorAddress));
    const members = roomRegistration.members.map(parseUser);
    for (const member of members) {
        await validateUserRegistration(member);
    }
    return { creator: creatorAddress, members };
}
export async function encodeEncryptedEvent(encryptedEvent, context) {
    return encodeSignedData(Messages.EncryptedEvent.encode(encryptedEvent), context);
}
export async function decodeEncryptedEvent(value, { room }) {
    const signedData = decodeSignedData(value);
    const encryptedEvent = Messages.EncryptedEvent.decode(signedData.data);
    assert(encryptedEvent.roomId === room.id, "event is for the wrong room");
    const senderAddress = getAddress(bytesToHex(encryptedEvent.senderAddress));
    const creator = room.members.find((member) => member.address === senderAddress);
    assert(creator !== undefined, "event sender is not a member of the room");
    assert(encryptedEvent.recipients.length > 0, "event has no recipients");
    assert(encryptedEvent.recipients.length === room.members.length - 1, "event has the wrong number of recipients");
    const senderPublicKey = bytesToHex(signedData.publicKey);
    assert(creator.keyBundle.signingPublicKey === senderPublicKey, "event not signed by the declared sender");
    return encryptedEvent;
}
