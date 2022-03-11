import React from 'react';
import ReactDOM from 'react-dom';
//import Message from './js/Message'

import './css/style.css';

ReactDOM.render(
    <>Hello world</>,
    document.getElementById('react-container') // eslint-disable-line no-undef
);

if (module.hot) { // eslint-disable-line no-undef
    module.hot.accept(); // eslint-disable-line no-undef
}
