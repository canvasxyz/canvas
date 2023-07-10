import type { WalletClient } from "viem";
import { PrivateUserRegistration } from "../shared/index.js";
export declare const getRegistrationKey: (address: string) => string;
export declare function createPrivateUserRegistration(walletClient: WalletClient, account: `0x${string}`, pin: string): Promise<PrivateUserRegistration>;
