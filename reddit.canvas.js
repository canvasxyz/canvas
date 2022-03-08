const threads = canvas.model('threads', {
  id: 'primary',
  title: 'text',
  link: 'text',
  creator: 'text',
  createdAt: 'datetime',
});
const comments = canvas.model('comments', {
  id: 'primary',
  threadId: 'threads.id',
  text: 'text',
  creator: 'text',
  createdAt: 'datetime',
});
const upvotes = canvas.model('upvotes', {
  id: 'primary',
  threadId: 'threads.id',
  creator: 'text',
  createdAt: 'datetime',
}, [canvas.uniqueIndex('threadId', 'creator')]);
const commentUpvotes = canvas.model('commentUpvotes', {
  id: 'primary',
  commentId: 'comments.id',
  creator: 'text',
  createdAt: 'datetime',
}, [canvas.uniqueIndex('commentId', 'creator')]);

canvas.route('/latest', 'SELECT * FROM threads ORDER BY createdAt DESC OFFSET :offset LIMIT 30');
canvas.route('/top', `SELECT threads.*, SUM(MIN(1, 1 / (julianday('now') - julianday(upvotes.created)))) as score, group_concat(upvotes.creator)
FROM threads JOIN upvotes ON thread.id = upvotes.threadId
WHERE votes.createdAt > NOW() - 90
ORDER BY score OFFSET :offset LIMIT 30`);
canvas.route('/:id/comments', `SELECT comments.*, COUNT(commentUpvotes), group_concat(commentUpvotes.creator) as upvotes FROM comments
JOIN commentUpvotes ON comments.id=commentUpvotes.commentId
ORDER BY upvotes DESC
OFFSET :offset
LIMIT 30`);

const thread = canvas.action('thread(title, link)', function (title, link) {
  return canvas.db.threads.create({ id: this.id, title, link, creator: this.origin });
});
const comment = canvas.action('comment(threadId, text)', function (threadId, text) {
  return canvas.db.comments.create({ id: this.id, threadId, text, creator: this.origin });
});
const upvote = canvas.action('upvote(threadId)', function (threadId) {
  return canvas.db.upvotes.create({ id: this.id, threadId, creator: this.origin });
});
const upvoteComment = canvas.action('upvoteComment(commentId)', function (commentId) {
  return canvas.db.commentUpvotes.create({ id: this.id, commentId, creator: this.origin });
});
