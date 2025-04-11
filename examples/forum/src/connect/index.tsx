import React, { useState, useEffect } from "react"

import { ConnectSIWE } from "./ConnectSIWE.js"
import { ConnectSIWF } from "./ConnectSIWF.js"

import FrameSDK from "@farcaster/frame-sdk"

export const Connect: React.FC<{ topic: string }> = ({ topic }) => {
	useEffect(() => {
		// @ts-ignore
		FrameSDK.actions.ready()
	}, [])

	return (
		<>
			<ConnectSIWE />
			<ConnectSIWF topic={topic} />
			<ConnectSIWF frame={true} topic={topic} />
		</>
	)
}
