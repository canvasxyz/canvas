import React from "react";
export const SelectWalletView = ({ selectWallet }) => {
    return (React.createElement("div", { className: "flex flex-row items-center justify-center grow h-screen overflow-hidden bg-gray-100" },
        React.createElement("div", { className: "container max-w-lg m-auto p-4 flex flex-col gap-4" },
            React.createElement("div", { className: "text-2xl font-bold" }, "Log in"),
            React.createElement("div", { className: `border rounded p-2 bg-gray-50 border-gray-400 drop-shadow-md hover:drop-shadow active:drop-shadow-sm hover:cursor-pointer hover:border-gray-300 hover:bg-gray-100`, onClick: () => selectWallet("metamask") }, "MetaMask"),
            React.createElement("div", { className: `border rounded p-2 bg-gray-50 border-gray-400 drop-shadow-md hover:drop-shadow active:drop-shadow-sm hover:cursor-pointer hover:border-gray-300 hover:bg-gray-100`, onClick: () => selectWallet("walletconnect") }, "WalletConnect"))));
};
