# TopperyAML - Presentazione

Una presentazione interattiva e moderna del progetto TopperyAML, creata con React e progettata come una presentazione PowerPoint professionale.

## 🎯 Caratteristiche

- **Design Moderno**: Interfaccia pulita e professionale con animazioni fluide
- **Navigazione Intuitiva**: Controlli keyboard e mouse per una navigazione facile
- **Responsive**: Ottimizzata per desktop, tablet e mobile
- **Fullscreen**: Modalità presentazione a schermo intero
- **Auto-play**: Modalità di riproduzione automatica
- **Indicatori**: Indicatori di slide per navigazione rapida

## 🚀 Funzionalità

### Controlli di Navigazione
- **Frecce**: `←` `→` per navigare tra le slide
- **Spazio**: Avanza alla slide successiva
- **F**: Attiva/disattiva modalità fullscreen
- **P**: Avvia/pausa modalità auto-play
- **Esc**: Esce dalla modalità fullscreen
- **Home**: Vai alla prima slide
- **End**: Vai all'ultima slide

### Contenuti della Presentazione
1. **Titolo**: Introduzione a TopperyAML
2. **Panoramica**: Obiettivi e tecnologie
3. **Dashboard AML**: Funzionalità di analisi
4. **Demo AML**: Esempi pratici
5. **Generatore Report**: Creazione documenti
6. **Pannello Admin**: Gestione utenti
7. **Sicurezza**: Caratteristiche di sicurezza
8. **Chrome Extensions**: Suite di estensioni
9. **Architettura**: Stack tecnologico
10. **Conclusione**: Riepilogo e contatti

## 🛠️ Tecnologie Utilizzate

- **React 18**: Framework UI
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **Framer Motion**: Animazioni
- **Vite**: Build tool
- **Lucide React**: Icone

## 📦 Installazione e Avvio

```bash
# Installa le dipendenze
npm install

# Avvia il server di sviluppo
npm run dev

# Build per produzione
npm run build

# Anteprima del build
npm run preview
```

## 🎨 Personalizzazione

La presentazione è completamente personalizzabile:

- **Slide**: Modifica il contenuto in `src/slides/index.tsx`
- **Stili**: Personalizza i CSS in `src/index.css`
- **Componenti**: Estendi i componenti in `src/components/`
- **Animazioni**: Configura le animazioni con Framer Motion

## 📱 Responsive Design

La presentazione si adatta automaticamente a:
- **Desktop**: Esperienza completa con tutti i controlli
- **Tablet**: Layout ottimizzato per touch
- **Mobile**: Interfaccia semplificata e touch-friendly

## 🔧 Configurazione

### Porta di Sviluppo
La presentazione si avvia su porta `3001` per evitare conflitti con l'app principale.

### Build
Il build produce file ottimizzati nella cartella `dist/` pronti per il deploy.

## 🚀 Deploy

La presentazione può essere deployata su:
- **Netlify**: Drag & drop della cartella `dist/`
- **Vercel**: Connessione automatica al repository
- **GitHub Pages**: Deploy automatico
- **Render**: Deploy da repository

## 📄 Licenza

Questo progetto è parte del sistema TopperyAML e segue le stesse licenze del progetto principale.
