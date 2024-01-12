//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

library Varint {
    function get_length(uint256 n) internal pure returns (uint256) {
        uint256 tmp = n;
        uint256 num_bytes = 1;
        while (tmp > 0x7F) {
            tmp = tmp >> 7;
            num_bytes += 1;
        }
        return num_bytes;
    }

    function encode(uint256 n) internal pure returns (bytes memory) {
        // Count the number of groups of 7 bits
        // We need this pre-processing step since Solidity doesn't allow dynamic memory resizing
        uint256 num_bytes = get_length(n);

        bytes memory buf = new bytes(num_bytes);

        uint256 tmp = n;
        for (uint256 i = 0; i < num_bytes; i++) {
            // Set the first bit in the byte for each group of 7 bits
            buf[i] = bytes1(0x80 | uint8(tmp & 0x7F));
            tmp = tmp >> 7;
        }
        // Unset the first bit of the last byte
        buf[num_bytes - 1] &= 0x7F;

        return buf;
    }
}
