const polls = canvas.model('polls', {
  id: 'primary',
  title: 'text',
  creator: 'text',
  createdAt: 'datetime(now)',
});
const cards = canvas.model('cards', {
  id: 'primary',
  pollId: 'polls.id',
  text: 'text',
  creator: 'text',
  createdAt: 'datetime(now)',
});
const votes = canvas.model('votes', {
  id: 'primary',
  cardId: 'cards.id',
  isAgree: 'boolean',
  isDisagree: 'boolean',
  creator: 'text',
  createdAt: 'datetime(now)',
});

canvas.route('/polls/:page', `
SELECT * FROM polls ORDER BY createdAt DESC LIMIT 10 OFFSET (:page * 10)
`);
canvas.route('/cards/:id/:page', `
SELECT cards.id, cards.pollId, cards.text, cards.creator, cards.createdAt,
    count(upvotes.id), count(downvotes.id),
    group_concat(upvotes.creator), group_concat(downvotes.creator)
FROM cards
LEFT JOIN votes upvotes ON cards.id = upvotes.cardId
LEFT JOIN votes downvotes ON cards.id = downvotes.cardId
WHERE cards.pollId = :id
AND upvotes.isAgree = true
AND downvotes.isAgree = false
GROUP BY cards.id
LIMIT 10 OFFSET (:page * 10)`);

const createPoll = canvas.action('createPoll(title)', function (title) {
  return canvas.db.polls.create({ id: this.id, title, creator: this.origin });
});
const createCard = canvas.action('createCard(pollId, text)', function (pollId, text) {
  return canvas.db.cards.create({ id: this.id, pollId, text, creator: this.origin });
});
const createVote = canvas.action('createVote(cardId, value)', function (cardId, value) {
  return canvas.db.votes.create({
    id: this.id,
    cardId,
    isAgree: value === 'true',
    isDisagree: value === 'false',
    creator: this.origin
  });
});
