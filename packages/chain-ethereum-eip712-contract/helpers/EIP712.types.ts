import { ethers } from "hardhat";

export type SolidityTypesAsString =
  | "address"
  | "bytes"
  | "bytes1"
  | "bytes2"
  | "bytes3"
  | "bytes4"
  | "bytes5"
  | "bytes6"
  | "bytes7"
  | "bytes8"
  | "bytes9"
  | "bytes10"
  | "bytes11"
  | "bytes12"
  | "bytes13"
  | "bytes14"
  | "bytes15"
  | "bytes16"
  | "bytes17"
  | "bytes18"
  | "bytes19"
  | "bytes20"
  | "bytes21"
  | "bytes22"
  | "bytes23"
  | "bytes24"
  | "bytes25"
  | "bytes26"
  | "bytes27"
  | "bytes28"
  | "bytes29"
  | "bytes30"
  | "bytes31"
  | "bytes32"
  | "string"
  | "uint8"
  | "uint256";

export type EIP712TypeDefinition = {
  [key: string]: {
    name: string;
    type: SolidityTypesAsString;
  }[];
};

export type EIP712Domain = {
  name: string;
  version: string;
  verifyingContract: string;
  chainId: number;
};

export type HardhatSignerType = Awaited<
  Promise<PromiseLike<ReturnType<typeof ethers.getSigner>>>
>;
