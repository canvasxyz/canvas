const polls = canvas.model('polls', {
  id: 'primary',
  title: 'text',
  creator: 'text',
  createdAt: 'datetime',
});
const cards = canvas.model('cards', {
  id: 'primary',
  pollId: 'polls.id',
  text: 'text',
  creator: 'text',
  createdAt: 'datetime',
});
const votes = canvas.model('votes', {
  id: 'primary',
  cardId: 'cards.id',
  isAgree: 'boolean',
  isDisagree: 'boolean',
  isSkip: 'boolean',
  creator: 'text',
  createdAt: 'datetime',
});

canvas.route('/polls', 'SELECT * FROM polls ORDER BY createdAt DESC LIMIT 10');
canvas.route('/polls/:id', 'SELECT cards.id, cards.pollId, cards.text, cards.creator, cards.createdAt, count(votes.id), group_concat(votes.creator) FROM cards LEFT JOIN votes ON cards.id = votes.cardId WHERE cards.pollId = :id GROUP BY cards.id');

const createPoll = canvas.action('createPoll(title)', function (title) {
  return canvas.db.polls.create({ id: this.id, title, creator: this.origin });
});
const createCard = canvas.action('createCard(pollId, text)', function (pollId, text) {
  return canvas.db.cards.create({ id: this.id, pollId, text, creator: this.origin });
});
const createVote = canvas.action('createVote(cardId, value)', function (cardId, value) {
  return canvas.db.votes.create({ id: this.id,
                                    cardId,
                                    isAgree: value === true,
                                    isDisagree: value === false,
                                    isSkip: value === null,
                                    creator: this.origin });
});
