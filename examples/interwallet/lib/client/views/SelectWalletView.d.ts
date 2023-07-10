import React from "react";
export type WalletName = "metamask" | "walletconnect";
export declare const SelectWalletView: ({ selectWallet }: {
    selectWallet: (wallet: WalletName) => void;
}) => React.JSX.Element;
