import React from "react"

export type WalletName = "metamask" | "walletconnect"

export const SelectWalletView = ({ selectWallet }: { selectWallet: (wallet: WalletName) => void }) => {
	return (
		<div className="flex flex-row items-center justify-center h-screen overflow-hidden bg-white">
			<div className="container max-w-lg m-auto p-4 bg-gray-100 flex flex-col gap-4">
				<div className="text-2xl font-bold">Log in</div>
				<div
					className={`border rounded p-2 bg-gray-50 border-gray-400 drop-shadow-md hover:drop-shadow active:drop-shadow-sm hover:cursor-pointer hover:border-gray-300 hover:bg-gray-100`}
					onClick={() => selectWallet("metamask")}
				>
					MetaMask
				</div>
				{/* <div
					className={`border rounded p-2 bg-gray-50 border-gray-400 drop-shadow-md hover:drop-shadow active:drop-shadow-sm hover:cursor-pointer hover:border-gray-300 hover:bg-gray-100`}
					onClick={() => selectWallet("walletconnect")}
				>
					WalletConnect
				</div> */}
			</div>
		</div>
	)
}
