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

    const thread = await signAndPost('thread', {
        title: 'Show HN: Calenday, real-time collaborative calendars',
        link: 'https://calenday.co/?ref=hn',
    });
    const comment1 = await signAndPost('comment', {
        threadId: thread,
        text: 'My 2 cents: It’s really hard to get consumers to switch behaviors for something they already can do through other means. Perhaps this is more efficient in some respect, but only if you ignore the inefficiency of changing your ways to learn a new tool, and further separate it from your existing communications medium (ie text messaging or whatever). I don’t feel like the value proposition is super high here.'
    });
    const comment2 = await signAndPost('comment', {
        threadId: thread,
        text: 'Neat! A collaborative itinerary seems really useful. Any plans to add or design features around coordinating flights for these types of trips? In my experience this tends to be the hardest thing to keep track of collaboratively. I’ve actually also seen friends using spreadsheets to track flights. It could be cool to add a feature that shows when everyone is landing or leaving.'
    });
    const comment3 = await signAndPost('comment', {
        threadId: thread,
        // replyTo: comment2
        text: 'That’s a really cool idea! A friend mentioned something similar. I will look into that, I think the UX might be hard to nail down. I am not sure on how to best indicate it, but it might be interesting to show availability of each person as a shaded background. Darker shade would mean more people present. I will put it on my backlog, thank you!'
    });

    await signAndPost('voteThread', { threadId: thread, value: 1 });

    await signAndPost('voteComment', { commentId: comment1, value: -1 });
    await signAndPost('voteComment', { commentId: comment2, value: 1 });

    // await axios.get(`${ROOT_PATH}/latest`).then((({ data }) => {
    //     console.log('latest:', data);
    // }));
    await axios.get(`${ROOT_PATH}/top`).then((({ data }) => {
        console.log('top:', data);
    }));
})();
