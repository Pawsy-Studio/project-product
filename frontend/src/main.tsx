  import React from 'react';
  import ReactDOM from 'react-dom/client';
  import { getInfo } from './services/widgetBridge';
  import DrawingApp from './App.tsx';

  (window as any).getInfo = getInfo;


  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );

  root.render(
    <React.StrictMode>
      <DrawingApp />
    </React.StrictMode>
  );