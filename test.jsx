export const models = {
	posts: {
		id: "string",
		from_id: "string",
		content: "string",
		updated_at: "datetime",
	},
	likes: {
		id: "string",
		from_id: "string",
		post_id: "string",
		value: "boolean",
		updated_at: "datetime",
	},
}

export const routes = {
	"/posts": `
    SELECT posts.*, COUNT(IIF(likes.value, 1, NULL)) as likes
        FROM posts LEFT JOIN likes ON likes.post_id = posts.id
        WHERE posts.updated_at <= :t
        GROUP BY posts.id ORDER BY posts.updated_at DESC LIMIT 50`,
	"/posts/as/:from_id": `
	  SELECT posts.*, COUNT(likes.id) as likes, COUNT(my_likes.id) as my_likes,
        group_concat(likes.from_id) as all_likes
        FROM posts
        LEFT JOIN likes ON likes.post_id = posts.id
        LEFT JOIN likes my_likes ON my_likes.post_id = posts.id
            AND my_likes.post_id = posts.id AND my_likes.from_id = :from_id
        GROUP BY posts.id ORDER BY posts.updated_at DESC LIMIT 50`,
}

export const actions = {
	createPost(content) {
		this.db.posts.set(this.hash, { content, from_id: this.from })
	},
	like(postId) {
		this.db.likes.set(`${this.from}/${postId}`, { post_id: postId, from_id: this.from, value: true })
	},
	unlike(postId) {
		this.db.likes.set(`${this.from}/${postId}`, { post_id: postId, from_id: this.from, value: false })
	},
}

export const component = ({ React, routes, actions, useRef }, { props }) => {
	const inputRef = useRef()
	return (
		<div className="m-10 p-10 bg-gray-100 rounded">
			<form
				onSubmit={() => {
					actions.createPost(inputRef.current.value)
				}}
			>
				<input type="text" placeholder="New post..." ref={inputRef} />
				<input type="submit" value="Post" />
			</form>
			{routes.subscribe("/posts")?.map((post) => (
				<Text>{post.content}</Text>
			))}
		</div>
	)
}
