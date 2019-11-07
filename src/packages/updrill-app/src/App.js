import React, { Component } from 'react';
import Dialog from './components/Dialog.js';
import './App.css';

class App extends Component {
  render() {
    return (
      <div className="app">
        <header className="app-header">
          <Dialog />
        </header>
      </div>
    );
  }
}

export default App;
