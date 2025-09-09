import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

console.log('🚀 Initializing landing page...');

createRoot(document.getElementById("root")!).render(<App />);
