import React from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  DollarSign, 
  FileText, 
  Users, 
  Puzzle, 
  BarChart3, 
  Lock, 
  Upload,
  Download,
  Eye,
  Settings,
  Zap,
  Brain,
  Globe,
  Star,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Database,
  Search,
  Filter,
  Calendar,
  Clock,
  Target,
  Award,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { TitleSlide } from '../components/slides/TitleSlide';
import { FeatureSlide } from '../components/slides/FeatureSlide';
import { ContentSlide } from '../components/slides/ContentSlide';
import { ImageSlide } from '../components/slides/ImageSlide';
import { Feature, Extension } from '../types';

// Define features for different sections
const amlFeatures: Feature[] = [
  {
    icon: <Upload className="w-8 h-8 text-blue-600" />,
    title: "Upload & Analysis",
    description: "Carica file Excel/CSV per analisi AML automatiche",
    details: [
      "Supporto per formati Excel e CSV",
      "Parsing automatico dei dati",
      "Validazione dei formati",
      "Gestione errori avanzata"
    ]
  },
  {
    icon: <BarChart3 className="w-8 h-8 text-green-600" />,
    title: "Analisi Avanzata",
    description: "Algoritmi sofisticati per rilevare pattern sospetti",
    details: [
      "Rilevamento transazioni frazionate",
      "Analisi sessioni notturne",
      "Calcolo risk score",
      "Pattern recognition"
    ]
  },
  {
    icon: <Eye className="w-8 h-8 text-purple-600" />,
    title: "Dashboard Interattiva",
    description: "Visualizzazione completa dei risultati",
    details: [
      "Grafici interattivi",
      "Tabelle dettagliate",
      "Filtri avanzati"
    ]
  },
];

const reviewFeatures: Feature[] = [
  {
    icon: <FileText className="w-8 h-8 text-blue-600" />,
    title: "Generatore Report",
    description: "Creazione automatica di report AML professionali",
    details: [
      "Template predefiniti",
      "Personalizzazione contenuti",
      "Export in Word",
      "Formattazione automatica"
    ]
  },
  {
    icon: <Settings className="w-8 h-8 text-green-600" />,
    title: "Configurazione Avanzata",
    description: "Personalizzazione completa dei report",
    details: [
      "Editor WYSIWYG",
      "Template personalizzati",
      "Variabili dinamiche",
      "Anteprima in tempo reale"
    ]
  }
];

const adminFeatures: Feature[] = [
  {
    icon: <Users className="w-8 h-8 text-blue-600" />,
    title: "Gestione Utenti",
    description: "Controllo completo degli utenti del sistema",
    details: [
      "Creazione nuovi utenti",
      "Modifica credenziali",
      "Gestione permessi",
      "Monitoraggio attività"
    ]
  },
  {
    icon: <BarChart3 className="w-8 h-8 text-green-600" />,
    title: "Analytics Avanzate",
    description: "Statistiche dettagliate sull'utilizzo",
    details: [
      "Metriche di utilizzo",
      "Grafici temporali",
      "Report di performance",
      "Export dati"
    ]
  },
  {
    icon: <Shield className="w-8 h-8 text-purple-600" />,
    title: "Sicurezza",
    description: "Sistema di sicurezza avanzato",
    details: [
      "Account lockout",
      "Log di sicurezza",
      "Autenticazione forte",
      "Monitoraggio accessi"
    ]
  }
];

const extensions: Extension[] = [
  {
    name: "Vega Image",
    description: "Advanced image processing and optimization tools",
    icon: <Star className="w-8 h-8 text-blue-500" />,
    features: ["Image optimization", "Format conversion", "Batch processing"],
    url: "https://get.toppery.work/toppery-image"
  },
  {
    name: "TopText",
    description: "Smart text enhancement and formatting tools",
    icon: <FileText className="w-8 h-8 text-green-500" />,
    features: ["Text formatting", "Smart editing", "Grammar check"],
    url: "https://get.toppery.work/toptext"
  },
  {
    name: "TopText AI",
    description: "AI-powered text generation and writing assistance",
    icon: <Brain className="w-8 h-8 text-yellow-500" />,
    features: ["AI writing", "Smart completion", "Content enhancement"],
    url: "https://get.toppery.work/toptext-ai"
  },
  {
    name: "Vega IP",
    description: "IP management and network analysis tools",
    icon: <Globe className="w-8 h-8 text-purple-500" />,
    features: ["IP tracking", "Network analysis", "Security tools"],
    url: "https://get.toppery.work/toppery-ip"
  }
];

const securityFeatures: Feature[] = [
  {
    icon: <Lock className="w-8 h-8 text-red-600" />,
    title: "Account Lockout",
    description: "Sistema di blocco automatico per tentativi falliti",
    details: [
      "Blocco temporaneo account",
      "Timer di sblocco",
      "Notifiche di sicurezza",
      "Log dettagliati"
    ]
  },
  {
    icon: <Shield className="w-8 h-8 text-blue-600" />,
    title: "Autenticazione Sicura",
    description: "Sistema di login robusto e sicuro",
    details: [
      "Password hashing",
      "Session management",
      "CSRF protection",
      "Secure cookies"
    ]
  },
  {
    icon: <AlertTriangle className="w-8 h-8 text-orange-600" />,
    title: "Monitoraggio Sicurezza",
    description: "Controllo continuo delle attività sospette",
    details: [
      "Log di sicurezza",
      "Alert automatici",
      "Analisi pattern",
      "Report incidenti"
    ]
  }
];

export const slides = [
  // Slide 1: Title
  {
    id: 'title',
    title: 'Vega',
    subtitle: 'Sistema Avanzato di Analisi AML',
    content: (
      <TitleSlide
        title="Vega"
        subtitle="Sistema Avanzato di Analisi AML"
        description="Piattaforma completa per l'analisi Anti-Money Laundering con strumenti avanzati di rilevamento, reporting e gestione utenti."
      />
    ),
    type: 'title' as const
  },

  // Slide 2: Overview
  {
    id: 'overview',
    title: 'Panoramica del Sistema',
    subtitle: 'Una soluzione completa per l\'analisi AML',
    content: (
      <ContentSlide
        title="Panoramica del Sistema"
        subtitle="Una soluzione completa per l'analisi AML"
        content={
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-primary">🎯 Obiettivo</h3>
                <p className="text-lg text-muted-foreground">
                  Fornire strumenti avanzati per l'analisi e il rilevamento di attività 
                  sospette di riciclaggio di denaro attraverso algoritmi sofisticati e 
                  interfacce intuitive.
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-primary">🚀 Tecnologie</h3>
                <div className="flex flex-wrap gap-2">
                  {['React', 'TypeScript', 'Supabase', 'Tailwind CSS', 'Chart.js'].map((tech) => (
                    <span key={tech} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-r from-primary/5 to-accent/5 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">✨ Caratteristiche Principali</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Analisi automatica</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Dashboard interattiva</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Gestione utenti</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Sicurezza avanzata</span>
                </div>
              </div>
            </div>
          </div>
        }
      />
    ),
    type: 'content' as const
  },

  // Slide 3: AML Dashboard Features
  {
    id: 'aml-features',
    title: 'Dashboard AML',
    subtitle: 'Analisi avanzata e rilevamento pattern sospetti',
    content: (
      <FeatureSlide
        title="Dashboard AML"
        subtitle="Analisi avanzata e rilevamento pattern sospetti"
        features={amlFeatures}
        layout="grid"
      />
    ),
    type: 'feature' as const
  },

  // Slide 4: AML Dashboard Screenshot
  {
    id: 'aml-dashboard',
    title: 'Dashboard AML',
    subtitle: 'Interfaccia principale del sistema di analisi',
    content: (
      <ImageSlide
        title="Dashboard AML"
        subtitle="Interfaccia principale del sistema di analisi"
        imagePath="/screenshots2/screencapture-toppery-work-toppery-aml-2025-09-26-21_03_02.png"
        imageAlt="Dashboard principale Vega"
      />
    ),
    type: 'demo' as const
  },

  // Slide 5: AML Analysis Screenshot
  {
    id: 'aml-analysis',
    title: 'Analisi AML in Azione',
    subtitle: 'Processo di analisi e rilevamento pattern sospetti',
    content: (
      <ImageSlide
        title="Analisi AML in Azione"
        subtitle="Processo di analisi e rilevamento pattern sospetti"
        imagePath="/screenshots2/screencapture-toppery-work-toppery-aml-2025-09-26-21_03_32.png"
        imageAlt="Analisi AML con grafici e metriche"
        description="In questa pagina vengono mostrate le transazioni frazionate identificate dal sistema, con un summary completo del profilo di rischio dell'utente basato sui pattern di comportamento rilevati."
      />
    ),
    type: 'demo' as const
  },

  // Slide 6: AML Results Screenshot
  {
    id: 'aml-results',
    title: 'Risultati Analisi',
    subtitle: 'Visualizzazione dettagliata dei risultati AML',
    content: (
      <ImageSlide
        title="Risultati Analisi"
        subtitle="Visualizzazione dettagliata dei risultati AML"
        imagePath="/screenshots2/screencapture-toppery-work-toppery-aml-2025-09-26-21_03_56.png"
        imageAlt="Risultati analisi AML dettagliati"
        description="La pagina 'Sessioni Notturne' mostra un calcolo basato sull'attività notturna identificata dell'utente, analizzando i pattern di gioco durante le ore notturne per identificare comportamenti sospetti."
      />
    ),
    type: 'demo' as const
  },

  // Slide 7: Advanced Analysis Screenshot
  {
    id: 'aml-advanced',
    title: 'Analisi Avanzata',
    subtitle: 'Funzionalità avanzate di analisi AML',
    content: (
      <ImageSlide
        title="Analisi Avanzata"
        subtitle="Funzionalità avanzate di analisi AML"
        imagePath="/screenshots2/screencapture-toppery-work-toppery-aml-2025-09-26-21_04_06.png"
        imageAlt="Analisi avanzata AML"
        description="La pagina 'Grafici' presenta una visualizzazione completa del gameplay e dell'attività generale dell'utente attraverso grafici interattivi che mostrano pattern di comportamento, sessioni di gioco e trend temporali."
      />
    ),
    type: 'demo' as const
  },

  // Slide 8: Review Generator Screenshot
  {
    id: 'review-generator',
    title: 'Generatore Report',
    subtitle: 'Creazione automatica di report professionali',
    content: (
      <ImageSlide
        title="Generatore Report"
        subtitle="Creazione automatica di report professionali"
        imagePath="/screenshots2/screencapture-toppery-work-toppery-aml-2025-09-26-21_05_05.png"
        imageAlt="Generatore report AML"
        description="La pagina 'Analisi AI' anonimizza i dati dell'utente, inviando solo informazioni relative a gameplay e transazioni senza identificatori sensibili come nickname. L'AI genera summary e grafici, con un chatbot per richiedere ulteriori informazioni sull'attività."
      />
    ),
    type: 'demo' as const
  },

  // Slide 9: Admin Panel Screenshot
  {
    id: 'admin-panel',
    title: 'Pannello Amministratore',
    subtitle: 'Gestione completa del sistema e degli utenti',
    content: (
      <ImageSlide
        title="Pannello Amministratore"
        subtitle="Gestione completa del sistema e degli utenti"
        imagePath="/screenshots2/screencapture-toppery-work-toppery-aml-2025-09-26-21_05_30.png"
        imageAlt="Pannello amministratore"
        description="La pagina 'Transazioni' analizza i file Excel di depositi e prelievi importati, generando un summary di tutti i metodi di pagamento utilizzati e creando grafici per visualizzare meglio l'attività finanziaria dell'utente."
      />
    ),
    type: 'demo' as const
  },

  // Slide 10: Security Features Screenshot
  {
    id: 'security-features',
    title: 'Sicurezza Avanzata',
    subtitle: 'Protezione completa del sistema e dei dati',
    content: (
      <ImageSlide
        title="Sicurezza Avanzata"
        subtitle="Protezione completa del sistema e dei dati"
        imagePath="/screenshots2/screencapture-toppery-work-toppery-aml-2025-09-26-21_05_55.png"
        imageAlt="Sistema di sicurezza avanzato"
        description="La pagina 'Movimenti Importanti' identifica e analizza i movimenti con gli importi maggiori, mostrando un summary dettagliato di cosa è successo prima e dopo il movimento identificato per comprendere meglio il contesto delle transazioni significative."
      />
    ),
    type: 'demo' as const
  },

  // Slide 11: System Overview Screenshot
  {
    id: 'system-overview',
    title: 'Panoramica Sistema',
    subtitle: 'Vista completa delle funzionalità del sistema',
    content: (
      <ImageSlide
        title="Panoramica Sistema"
        subtitle="Vista completa delle funzionalità del sistema"
        imagePath="/screenshots2/screencapture-toppery-work-toppery-aml-2025-09-26-21_06_20.png"
        imageAlt="Panoramica sistema Vega"
        description="La pagina 'Accessi' analizza i file Excel degli IP del giocatore, esaminando gli indirizzi IP e visualizzando informazioni dettagliate riguardanti la località geografica e i pattern di accesso dell'utente."
      />
    ),
    type: 'demo' as const
  },


  // Slide 13: Technical Architecture
  {
    id: 'architecture',
    title: 'Architettura Tecnica',
    subtitle: 'Stack tecnologico e architettura del sistema',
    content: (
      <ContentSlide
        title="Architettura Tecnica"
        subtitle="Stack tecnologico e architettura del sistema"
        content={
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-primary">🖥️ Frontend</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-sm">R</span>
                    </div>
                    <div>
                      <div className="font-semibold">React 18</div>
                      <div className="text-sm text-muted-foreground">UI Framework</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-sm">TS</span>
                    </div>
                    <div>
                      <div className="font-semibold">TypeScript</div>
                      <div className="text-sm text-muted-foreground">Type Safety</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-cyan-100 rounded flex items-center justify-center">
                      <span className="text-cyan-600 font-bold text-sm">TW</span>
                    </div>
                    <div>
                      <div className="font-semibold">Tailwind CSS</div>
                      <div className="text-sm text-muted-foreground">Styling</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-100 rounded flex items-center justify-center">
                      <span className="text-purple-600 font-bold text-sm">FM</span>
                    </div>
                    <div>
                      <div className="font-semibold">Framer Motion</div>
                      <div className="text-sm text-muted-foreground">Animations</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-primary">⚙️ Backend & Tools</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">
                      <span className="text-green-600 font-bold text-sm">S</span>
                    </div>
                    <div>
                      <div className="font-semibold">Supabase</div>
                      <div className="text-sm text-muted-foreground">Database & Auth</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-orange-100 rounded flex items-center justify-center">
                      <span className="text-orange-600 font-bold text-sm">C</span>
                    </div>
                    <div>
                      <div className="font-semibold">Chart.js</div>
                      <div className="text-sm text-muted-foreground">Data Visualization</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                      <span className="text-red-600 font-bold text-sm">D</span>
                    </div>
                    <div>
                      <div className="font-semibold">DocxTemplater</div>
                      <div className="text-sm text-muted-foreground">Document Generation</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-yellow-100 rounded flex items-center justify-center">
                      <span className="text-yellow-600 font-bold text-sm">V</span>
                    </div>
                    <div>
                      <div className="font-semibold">Vite</div>
                      <div className="text-sm text-muted-foreground">Build Tool</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      />
    ),
    type: 'content' as const
  },

  // Slide 14: Conclusion
  {
    id: 'conclusion',
    title: 'Conclusione',
    subtitle: 'Vega: La soluzione completa per l\'analisi AML',
    content: (
      <div className="presentation-slide">
        <div className="slide-content">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-12"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, duration: 0.6, type: "spring" }}
                className="w-24 h-24 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl"
              >
                <Award className="w-12 h-12 text-white" />
              </motion.div>
              
              <h1 className="slide-title mb-6">Grazie per l'attenzione!</h1>
              <p className="text-2xl text-muted-foreground mb-8">
                Vega: La soluzione completa per l'analisi AML
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="max-w-4xl mx-auto"
            >
              <div className="text-center mb-8">
                <h3 className="text-3xl font-semibold text-primary mb-6">🎯 Vantaggi Chiave</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>Analisi automatica avanzata</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>Interfaccia intuitiva</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>Sicurezza enterprise</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>Report professionali</span>
                  </div>
                </div>
              </div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="text-center"
              >
                <a 
                  href="https://aml.toppery.work" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-8 py-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-lg font-semibold shadow-lg hover:shadow-xl"
                >
                  <ExternalLink className="w-5 h-5 mr-3" />
                  Prova Vega
                </a>
              </motion.div>
            </motion.div>

          </motion.div>
        </div>
      </div>
    ),
    type: 'conclusion' as const
  }
];
