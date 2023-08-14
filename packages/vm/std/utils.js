const octets = Array.from(
  { length: 256 },
  (v, i) => i.toString(16).padStart(2, "0"),
);

export function bytesToHex(bytes) {
  if (bytes instanceof Uint8Array) {
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      hex += octets[bytes[i]];
    }

    return hex;
  } else {
    throw new Error("Uint8Array expected");
  }
}

export function hexToBytes(hex) {
  if (typeof hex !== "string") {
    throw new Error("hex string expected, got " + typeof hex);
  }

  const len = hex.length;
  if (len % 2 !== 0) {
    throw new Error(
      "padded hex string expected, got unpadded hex of length " + len,
    );
  }

  const array = new Uint8Array(len / 2);
  for (let i = 0; i < array.length; i++) {
    const j = i * 2;
    const octet = hex.slice(j, j + 2);
    const byte = Number.parseInt(octet, 16);
    if (Number.isNaN(byte) || byte < 0) {
      throw new Error("Invalid byte sequence");
    }

    array[i] = byte;
  }

  return array;
}
