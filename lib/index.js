const HomeComponent = () => {
  const { data: polls } = useSWR('https://alpha.canvas.xyz/app/Qmxzh100/polls');

  // const [store, actions] = useCanvas('../examples/polis.canvas.js', { db: false, server: 'https://alpha.canvas.xyz' }, {
  //   polls: '/polls'
  // }, []);

  return <>
    {views.polls.map((poll) => <Poll poll={poll}>)}
  </>;
};

const PageComponent = ({ id }) => {
  const { data: cards } = useSWR('https://alpha.canvas.xyz/app/Qmxzh100/cards');

  // const [store, actions] = useCanvas('../examples/polis.canvas.js', { db: false, server: 'https://alpha.canvas.xyz' }, {
  //   cards: (id) => `/polls/${id}/cards`
  // }, [id]);

  return <>
    <form className="new-card" onSubmit={() => actions.send('createCard', 'new card')}>
    </form>
    // make an action =>
    // verify that the node has accepted your action =>
    // reflect the action on the frontend
    {views.cards.map((card) => <Card card={card}>)}
  </>;
};
