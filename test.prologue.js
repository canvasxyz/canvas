//export default (prologue) => {
    const polls = prologue.model('polls', {
        id: 'primary',
        title: 'text',
        creator: 'text',
        createdAt: 'datetime',
    });
    const cards = prologue.model('cards', {
        id: 'primary',
        pollId: 'polls.id',
        text: 'text',
        creator: 'text',
        createdAt: 'datetime',
    });
    const votes = prologue.model('votes', {
        id: 'primary',
        cardId: 'cards.id',
        isAgree: 'boolean',
        isDisagree: 'boolean',
        isSkip: 'boolean',
        creator: 'text',
        createdAt: 'datetime',
    });

    prologue.route('/polls', 'SELECT * FROM polls ORDER BY createdAt DESC LIMIT 10');
    prologue.route('/polls/:id', 'SELECT cards.id, cards.pollId, cards.text, cards.creator, cards.createdAt, count(votes.id), group_concat(votes.creator) FROM cards LEFT JOIN votes ON cards.id = votes.cardId WHERE cards.pollId = :id GROUP BY cards.id');

    const createPoll = prologue.action('createPoll(title)', function (title) {
        return prologue.db.polls.create({ id: this.id, title, creator: this.origin });
    });
    const createCard = prologue.action('createCard(pollId, text)', function (pollId, text) {
        return prologue.db.cards.create({ id: this.id, pollId, text, creator: this.origin });
    });
    const createVote = prologue.action('createVote(cardId, value)', function (cardId, value) {
        return prologue.db.votes.create({ id: this.id,
                                          cardId,
                                          isAgree: value === true,
                                          isDisagree: value === false,
                                          isSkip: value === null,
                                          creator: this.origin });
    });
//};
