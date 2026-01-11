import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { getInfo } from './services/widgetBridge';

// 👇 Делаем доступным из консоли и iframe
(window as any).getInfo = getInfo;


const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);