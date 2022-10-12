import React, { useState, useMemo, useCallback, useRef, useLayoutEffect, useEffect } from "react"
import * as ReactDOM from "react-dom"

import { useRoute, useCanvas } from "@canvas-js/hooks"

type Post = {
	id: string
	from_id: string
	content: string
	updated_at: number
	likes: number
	my_likes: number
	all_likes: string
}

export const App: React.FC<{}> = ({}) => {
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
	}
	return <AppChild routes={routes} actions={actions} hooks={hooks} fn={mod.fn} />
}

export const AppChild = ({ routes, actions, hooks, fn }: { routes: any; actions: any; hooks: any; fn: any }) => {
	return fn({ React, actions, routes, ...hooks }, { props: {} })
}
