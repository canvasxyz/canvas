import React, { MouseEventHandler, useState, useMemo, useCallback, useRef, useLayoutEffect, useEffect } from "react"
import * as ReactDOM from "react-dom"

import { Canvas, useRoute, useCanvas } from "@canvas-js/hooks"
import { ActionArgument } from "@canvas-js/interfaces"

type Hooks = {
	useState: Function
	useMemo: Function
	useRef: Function
	useEffect: Function
	useRoute: Function
}

const hooks: Hooks = {
	useState,
	useMemo,
	useRef,
	useEffect,
	useRoute,
}

export const ModularSelect: React.FC<{
	name: string
	category: string
	onclick?: MouseEventHandler
	disabled?: boolean
	selected?: boolean
}> = ({ name, category, onclick, disabled, selected }) => {
	return (
		<div
			onClick={onclick}
			className={`flex mb-8 cursor-pointer ${
				disabled ? "pointer-events-none opacity-50" : "transform transition duration-200 hover:translate-y-0.5"
			}`}
		>
			<div className="w-12">{selected && <div className="mt-4">&#9654;</div>}</div>
			{/* icon */}
			<div className="mr-4">
				<div className="icon w-14 h-14 rounded-xl bg-gray-200 border border-white shadow-lg"></div>
			</div>
			{/* text */}
			<div className="w-full leading-snug">
				<div className={`text-lg mt-0.5 ${disabled ? "opacity-50" : ""}`}>{name}</div>
				<div className="text-gray-400">{category}</div>
			</div>
		</div>
	)
}

export const AppWrapper = () => {
	const [endpoint, setEndpoint] = useState<string>("http://localhost:8001")
	const [hidden, setHidden] = useState(false)
	useEffect(() => {
		setHidden(true)
		setTimeout(() => setHidden(false), 0)
	}, [endpoint])

	if (hidden) {
		return <App endpoint={endpoint} setEndpoint={setEndpoint} />
	}
	return (
		<Canvas host={endpoint}>
			<App endpoint={endpoint} setEndpoint={setEndpoint} />
		</Canvas>
	)
}

export const App: React.FC<{ setEndpoint: Function; endpoint: string }> = ({ setEndpoint, endpoint }) => {
	const {
		error: canvasError,
		cid,
		uri,
		spec,
		dispatch,
		connect,
		connectNewSession,
		disconnect,
		address,
		session,
	} = useCanvas()

	return (
		<div>
			<div className="w-full p-4 border-b border-white text-center">Canvas</div>
			{session?.address ? (
				<button onClick={disconnect}>Disconnect</button>
			) : address ? (
				<button onClick={connectNewSession}>Connect</button>
			) : (
				<button onClick={connect}>Connect</button>
			)}
			<div className="p-10">
				<div className="flex">
					<div className="w-72 mr-10">
						<ModularSelect
							name="Flappy Bird"
							category="Games"
							onclick={() => setEndpoint("http://localhost:8000")}
							selected={endpoint === "http://localhost:8000"}
						/>
						<ModularSelect
							name="Chat"
							category="Tools"
							onclick={() => setEndpoint("http://localhost:8001")}
							selected={endpoint === "http://localhost:8001"}
						/>
						<ModularSelect name="TinyRoam" category="Tools" disabled />
					</div>
					<div className="w-72">
						{!endpoint ? (
							<div className="text-gray-400">Select an app</div>
						) : (
							<>
								<div
									className="relative overflow-scroll border border-gray-200 rounded-lg shadow-lg bg-white"
									style={{ width: 360, height: 500 }}
								>
									<Modular spec={spec} dispatch={dispatch} hash={endpoint} />
								</div>
								<div className="m-1 mt-10 font-mono text-sm text-gray-400">Connected to {endpoint}</div>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

export const Modular: React.FC<{ spec: string | null; hash: string; dispatch: Function }> = ({
	spec,
	hash,
	dispatch,
}) => {
	const [mod, setMod] = useState<{ fc: React.FC } | null>()

	useEffect(() => {
		if (spec === null) return
		const dataUri = "data:text/javascript;charset=utf-8," + encodeURIComponent(spec)
		import(/* webpackIgnore: true */ dataUri).then((mod) => setMod({ fc: mod.component }))
	}, [spec])

	const wrappedDispatch = (call: string, ...args: string[]) => {
		console.log("called dispatch:", call, ...args)
		return dispatch.call(null, call, ...args).catch((err: Error) => {
			console.error(err)
			throw err
		})
	}

	if (!mod) {
		return <div className="text-center mt-60 text-gray-400">Loading...</div>
	} else {
		return <ModularChild dispatch={wrappedDispatch} hooks={hooks} fc={mod.fc} />
	}
}

// Return a separate component to avoid issues with hook reuse detection
export const ModularChild = ({ dispatch, fc, hooks }: { dispatch: Function; hooks: Hooks; fc: React.FC }) => {
	return fc({ React, dispatch, ...hooks }, {})
}
