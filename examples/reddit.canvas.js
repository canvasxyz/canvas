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
const threadVotes = canvas.model('threadVotes', {
  id: 'primary',
  threadId: 'threads.id',
  creator: 'text',
  createdAt: 'datetime',
}); // canvas.uniqueIndex('threadId', 'creator')
const commentVotes = canvas.model('commentVotes', {
  id: 'primary',
  commentId: 'comments.id',
  creator: 'text',
  createdAt: 'datetime',
}); // canvas.uniqueIndex('commentId', 'creator')

canvas.route('/latest', `SELECT threads.*, COUNT(comments.id)
FROM threads
    JOIN comments ON comments.threadId = threads.id
GROUP BY threads.id
ORDER BY threads.createdAt DESC
LIMIT 30
`);

canvas.route('/top', `SELECT
    threads.*,
    SUM(
        1 / (cast(strftime('%s','now') as float) * 1000 - threadVotes.createdAt)
    ) AS score,
    group_concat(threadVotes.creator)
FROM threads
    LEFT JOIN threadVotes ON threads.id = threadVotes.threadId
    WHERE threadVotes.createdAt > datetime('now', '-90 days')
GROUP BY threads.id
ORDER BY score DESC
LIMIT 30`);

canvas.route('/threads/:threadId/comments', `SELECT
    comments.*,
    SUM(
        1 / (cast(strftime('%s','now') as float) * 1000 - commentVotes.createdAt)
    ) AS score,
    group_concat(commentVotes.creator)
FROM comments
    LEFT JOIN commentVotes ON comments.id = commentVotes.commentId
    WHERE comments.threadId = :threadId
GROUP BY comments.id
ORDER BY score DESC
LIMIT 30`);

const thread = canvas.action('thread(title, link)', function (title, link) {
    return canvas.db.threads.create({
        id: this.id,
        title,
        link,
        creator: this.origin,
        createdAt: +new Date()
    });
});
const comment = canvas.action('comment(threadId, text)', function (threadId, text) {
    return canvas.db.comments.create({
        id: this.id,
        threadId,
        text,
        creator: this.origin,
        createdAt: +new Date()
    });
});
const voteThread = canvas.action('voteThread(threadId, value)', function (threadId, value) {
    //if (value !== 1 || value !== -1) return false;
    return canvas.db.threadVotes.create({
        id: this.id,
        threadId,
        creator: this.origin,
        // value,
        createdAt: timestamp,
    });
});
const voteComment = canvas.action('voteComment(commentId, value)', function (commentId, value) {
    //if (value !== 1 || value !== -1) return false;
    return canvas.db.commentVotes.create({
        id: this.id,
        commentId,
        creator: this.origin,
        // value,
        createdAt: timestamp,
    });
});
