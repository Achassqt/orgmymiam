import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './fonts.css';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root introuvable');
}

registerSW({ immediate: true });

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
