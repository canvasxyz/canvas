import React, { MouseEventHandler, useState, useMemo, useCallback, useRef, useLayoutEffect, useEffect } from "react"
import * as ReactDOM from "react-dom"

import { Canvas, useRoute, useCanvas } from "@canvas-js/hooks"

type Post = {
	id: string
	from_id: string
	content: string
	updated_at: number
	likes: number
	my_likes: number
	all_likes: string
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
	const [selectedHash, setSelectedHash] = useState("a")
	return (
		<Canvas host="http://localhost:8000">
			<App selectedHash={selectedHash} setSelectedHash={setSelectedHash} />
		</Canvas>
	)
}

export const App: React.FC<{ setSelectedHash: Function; selectedHash: string }> = ({
	setSelectedHash,
	selectedHash,
}) => {
	return (
		<div>
			<div className="w-full p-4 border-b border-white text-center">Canvas</div>
			<div className="p-10">
				<div className="flex">
					<div className="w-72 mr-10">
						<ModularSelect
							name="Flappy Bird"
							category="Games"
							onclick={() => setSelectedHash("a")}
							selected={selectedHash === "a"}
						/>
						<ModularSelect
							name="Gov House"
							category="Tools"
							onclick={() => setSelectedHash("b")}
							selected={selectedHash === "b"}
						/>
						<ModularSelect name="Home" category="Tools" disabled />
						<ModularSelect name="TinyRoam" category="Tools" disabled />
					</div>
					<div className="w-72">
						{!selectedHash ? (
							<div className="text-gray-400">Select an app</div>
						) : (
							<>
								<div
									className="relative overflow-scroll border border-gray-200 rounded-lg shadow-lg bg-white"
									style={{ width: 360, height: 500 }}
								>
									<Modular hash={selectedHash} />
								</div>
								<div className="m-1 mt-8 font-mono text-sm text-gray-400">Connecting to backend {selectedHash} ...</div>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

export const Modular: React.FC<{ hash: string }> = ({ hash }) => {
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
	const [mod, setMod] = useState<{ fn: (hooks: any, props: any) => React.ReactElement } | null>()

	useEffect(() => {
		if (spec === null) return
		const dataUri = "data:text/javascript;charset=utf-8," + encodeURIComponent(spec)
		import(/* webpackIgnore: true */ dataUri).then((mod) => {
			setMod({ fn: mod.component })
		})
	}, [spec])

	if (!mod) {
		return <div>Loading</div>
	}

	const routes = {
		subscribe: () => {
			console.log("called subscribe")
		},
	}
	const actions = {
		createPost: () => {
			console.log("called createPost")
		},
	}
	const hooks = {
		useState,
		useMemo,
		useRef,
		useEffect,
	}

	return <ModularChild routes={routes} actions={actions} hooks={hooks} fn={mod.fn} />
}

export const ModularChild = ({ routes, actions, hooks, fn }: { routes: any; actions: any; hooks: any; fn: any }) => {
	return fn({ React, actions, routes, ...hooks }, { props: {} })
}
