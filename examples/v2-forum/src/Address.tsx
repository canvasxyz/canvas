import { useEffect, useRef } from "react"
import { useEnsName, useEnsAvatar } from "wagmi"
import jazzicon from "@metamask/jazzicon"

function MetamaskAvatar({ account, className }: { account: string; className: string }) {
	const avatarRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const element = avatarRef.current
		if (element && account) {
			const addr = account.slice(2, 10)
			const seed = parseInt(addr, 16)
			const icon = jazzicon(20, seed)
			if (element.firstChild) {
				element.removeChild(element.firstChild)
			}
			element.appendChild(icon)
		}
	}, [account, avatarRef])
	return <div ref={avatarRef} className={className} />
}

export function Address({ address }: { address: string }) {
	const { data } = useEnsName({
		address: address as `0x{string}`,
		enabled: false,
	})

	const { data: avatar } = useEnsAvatar({ name: data })

	return (
		<span>
			<div className="relative -top-0.5 mr-1 inline-block">
				{avatar ? (
					<img className="w-6 h-6 rounded-full inline-block" src={avatar} />
				) : (
					<MetamaskAvatar account={address} className="w-6 h-6 relative top-1.5 rounded-full inline-block" />
				)}
			</div>

			<a className="hover:underline" href="#" onClick={(e) => e.preventDefault()} title={address}>
				{data ? data : <span>{address.slice(0, 7)}</span>}
			</a>
		</span>
	)
}
