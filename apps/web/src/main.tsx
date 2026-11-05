import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root')!;
const app = <StrictMode><App /></StrictMode>;
const returningGuest = localStorage.getItem('yeopjan.session') && localStorage.getItem('yeopjan.profile');
if (returningGuest) createRoot(root).render(app);
else hydrateRoot(root, app);
