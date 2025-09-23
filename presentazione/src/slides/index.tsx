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
      "Filtri avanzati",
      "Export multipli"
    ]
  },
  {
    icon: <Download className="w-8 h-8 text-orange-600" />,
    title: "Report & Export",
    description: "Generazione automatica di report professionali",
    details: [
      "Export in JSON",
      "Report dettagliati",
      "Formati multipli",
      "Stampa diretta"
    ]
  }
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
    name: "Toppery Image",
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
    name: "Toppery IP",
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
    title: 'TopperyAML',
    subtitle: 'Sistema Avanzato di Analisi AML',
    content: (
      <TitleSlide
        title="TopperyAML"
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
                  {['React', 'TypeScript', 'Supabase', 'Tailwind CSS', 'Chart.js', 'Framer Motion'].map((tech) => (
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
                  <span>Report professionali</span>
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
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Chrome Extensions</span>
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

  // Slide 4: AML Demo
  {
    id: 'aml-demo',
    title: 'Funzionalità AML in Azione',
    subtitle: 'Esempi pratici di analisi e rilevamento',
    content: (
      <ContentSlide
        title="Funzionalità AML in Azione"
        subtitle="Esempi pratici di analisi e rilevamento"
        content={
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-primary">📊 Analisi Transazioni</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center space-x-2">
                    <ArrowRight className="w-4 h-4 text-primary" />
                    <span>Rilevamento transazioni frazionate</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <ArrowRight className="w-4 h-4 text-primary" />
                    <span>Analisi sessioni notturne</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <ArrowRight className="w-4 h-4 text-primary" />
                    <span>Calcolo risk score automatico</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <ArrowRight className="w-4 h-4 text-primary" />
                    <span>Pattern recognition avanzato</span>
                  </li>
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-primary">📈 Visualizzazioni</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center space-x-2">
                    <ArrowRight className="w-4 h-4 text-primary" />
                    <span>Grafici interattivi Chart.js</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <ArrowRight className="w-4 h-4 text-primary" />
                    <span>Tabelle dati avanzate</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <ArrowRight className="w-4 h-4 text-primary" />
                    <span>Filtri e ricerca</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <ArrowRight className="w-4 h-4 text-primary" />
                    <span>Export multipli</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-xl font-semibold mb-3 text-blue-800">🎯 Esempio di Risk Score</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-white rounded-lg">
                  <div className="text-3xl font-bold text-green-600">LOW</div>
                  <div className="text-sm text-muted-foreground">0-30</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg">
                  <div className="text-3xl font-bold text-yellow-600">MEDIUM</div>
                  <div className="text-sm text-muted-foreground">31-70</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg">
                  <div className="text-3xl font-bold text-red-600">HIGH</div>
                  <div className="text-sm text-muted-foreground">71-100</div>
                </div>
              </div>
            </div>
          </div>
        }
      />
    ),
    type: 'demo' as const
  },

  // Slide 5: Review Generator
  {
    id: 'review-features',
    title: 'Generatore Report',
    subtitle: 'Creazione automatica di report professionali',
    content: (
      <FeatureSlide
        title="Generatore Report"
        subtitle="Creazione automatica di report professionali"
        features={reviewFeatures}
        layout="list"
      />
    ),
    type: 'feature' as const
  },

  // Slide 6: Admin Panel
  {
    id: 'admin-features',
    title: 'Pannello Amministratore',
    subtitle: 'Gestione completa del sistema e degli utenti',
    content: (
      <FeatureSlide
        title="Pannello Amministratore"
        subtitle="Gestione completa del sistema e degli utenti"
        features={adminFeatures}
        layout="highlight"
      />
    ),
    type: 'feature' as const
  },

  // Slide 7: Security Features
  {
    id: 'security-features',
    title: 'Sicurezza Avanzata',
    subtitle: 'Protezione completa del sistema e dei dati',
    content: (
      <FeatureSlide
        title="Sicurezza Avanzata"
        subtitle="Protezione completa del sistema e dei dati"
        features={securityFeatures}
        layout="grid"
      />
    ),
    type: 'feature' as const
  },

  // Slide 8: Chrome Extensions
  {
    id: 'extensions',
    title: 'Chrome Extensions',
    subtitle: 'Suite completa di estensioni per la produttività',
    content: (
      <ContentSlide
        title="Chrome Extensions"
        subtitle="Suite completa di estensioni per la produttività"
        content={
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {extensions.map((extension, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      {extension.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">{extension.name}</h3>
                      <p className="text-muted-foreground mb-3">{extension.description}</p>
                      <div className="space-y-1">
                        {extension.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center text-sm text-muted-foreground">
                            <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></span>
                            {feature}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="text-center">
              <p className="text-lg text-muted-foreground mb-4">
                Tutte le estensioni sono disponibili su Chrome Web Store
              </p>
              <div className="flex justify-center space-x-4">
                <a 
                  href="https://get.toppery.work" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Visita Toppery.work
                </a>
              </div>
            </div>
          </div>
        }
      />
    ),
    type: 'content' as const
  },

  // Slide 9: Technical Architecture
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
            <div className="bg-gradient-to-r from-primary/5 to-accent/5 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-4">🏗️ Architettura del Sistema</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-white rounded-lg">
                  <Database className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <h4 className="font-semibold">Database Layer</h4>
                  <p className="text-sm text-muted-foreground">Supabase PostgreSQL</p>
                </div>
                <div className="text-center p-4 bg-white rounded-lg">
                  <Shield className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <h4 className="font-semibold">Security Layer</h4>
                  <p className="text-sm text-muted-foreground">Auth & Permissions</p>
                </div>
                <div className="text-center p-4 bg-white rounded-lg">
                  <BarChart3 className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <h4 className="font-semibold">Analytics Layer</h4>
                  <p className="text-sm text-muted-foreground">AML Processing</p>
                </div>
              </div>
            </div>
          </div>
        }
      />
    ),
    type: 'content' as const
  },

  // Slide 10: Conclusion
  {
    id: 'conclusion',
    title: 'Conclusione',
    subtitle: 'TopperyAML: La soluzione completa per l\'analisi AML',
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
                TopperyAML: La soluzione completa per l'analisi AML
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="space-y-4"
              >
                <h3 className="text-2xl font-semibold text-primary">🎯 Vantaggi Chiave</h3>
                <ul className="space-y-3">
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>Analisi automatica avanzata</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>Interfaccia intuitiva</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>Sicurezza enterprise</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>Report professionali</span>
                  </li>
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="space-y-4"
              >
                <h3 className="text-2xl font-semibold text-primary">🚀 Prossimi Passi</h3>
                <ul className="space-y-3">
                  <li className="flex items-center space-x-3">
                    <Target className="w-5 h-5 text-blue-500" />
                    <span>Deploy su Netlify/Render</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <Target className="w-5 h-5 text-blue-500" />
                    <span>Integrazione API avanzate</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <Target className="w-5 h-5 text-blue-500" />
                    <span>Machine Learning</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <Target className="w-5 h-5 text-blue-500" />
                    <span>Mobile App</span>
                  </li>
                </ul>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="text-center"
            >
              <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-8 rounded-2xl">
                <h3 className="text-2xl font-bold mb-4">Contatti</h3>
                <p className="text-lg text-muted-foreground mb-4">
                  Per maggiori informazioni o demo personalizzate
                </p>
                <div className="flex justify-center space-x-6">
                  <a 
                    href="https://get.toppery.work" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Visita Toppery.work
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    ),
    type: 'conclusion' as const
  }
];
