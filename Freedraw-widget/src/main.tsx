import React from 'react';
import ReactDOM from 'react-dom/client';
import { ReactFlowProvider } from 'reactflow';
import App from './App.tsx'
import 'reactflow/dist/style.css';
import Board from './board.tsx';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <ReactFlowProvider>
      <Board />
    </ReactFlowProvider>
  </React.StrictMode>
);