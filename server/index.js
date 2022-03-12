import React from 'react';
import ReactDOM from 'react-dom';
import App from './App.js';

import './css/style.css';

ReactDOM.render(
    <App />,
    document.getElementById('react-container')
);

if (module.hot) {
    module.hot.accept();
}
