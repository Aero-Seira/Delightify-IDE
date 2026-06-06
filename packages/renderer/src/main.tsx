import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles';

// 全局错误处理（生产环境）
window.addEventListener('error', (event) => {
  console.error('[Global Error]', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
