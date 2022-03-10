(async () => {
    const ROOT_PATH = `http://localhost:8000/apps/${multihash}`;

    // create a test wallet, use that as our signer
    const signer = new ethers.Wallet('0x111111111111111111111111111111111111');
    const signAndPost = async (call, args) => {
        const message = JSON.stringify({ call, args });
        const signature = await signer.signMessage(message);
        const ret = (await axios.post(`${ROOT_PATH}/${call}`, {
            from: signer.address,
            signature,
            data: message
        })).data.id;
        return ret;
    };

    const pollId = await signAndPost('createPoll', { title: 'Should Verses adopt a motto?' });
    const cardId1 = await signAndPost('createCard', { pollId, text: 'Yes, we should vote on one now' });
    const cardId2 = await signAndPost('createCard', { pollId, text: 'Yes, with modifications to the question' });
    const cardId3 = await signAndPost('createCard', { pollId, text: 'No, we should leave it open' });
    await signAndPost('createVote', { cardId: cardId1, value: false });
    await signAndPost('createVote', { cardId: cardId1, value: true });

    await axios.get(`${ROOT_PATH}/polls/0`).then((({ data }) => {
        console.log(data);
    }));
    await axios.get(`${ROOT_PATH}/polls/${pollId}`).then((({ data }) => {
        console.log(data);
    }));
})();
