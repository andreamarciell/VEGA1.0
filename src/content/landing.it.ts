// Contenuti per la landing page in italiano
// TODO: Aggiornare con contenuti marketing specifici

export const landingContent = {
  hero: {
    headline: "Soluzioni intelligenti per analisi e produttività",
    subheadline: "Trasformiamo dati complessi in vantaggio competitivo con tecnologie all'avanguardia",
    primaryCta: "Scopri i prodotti",
    secondaryCta: "Contattaci",
    loginCta: "Login"
  },
  
  valueProposition: {
    title: "Perché scegliere Toppery",
    subtitle: "Soluzioni integrate per massimizzare la produttività e l'efficienza",
    features: [
      {
        icon: "Zap",
        title: "Automazione",
        description: "Processi automatizzati che riducono il lavoro manuale e gli errori"
      },
      {
        icon: "BarChart3",
        title: "Analisi Avanzate",
        description: "Intelligenza artificiale per analisi predittive e pattern recognition"
      },
      {
        icon: "Shield",
        title: "Sicurezza",
        description: "Protezione dei dati con standard enterprise e compliance"
      },
      {
        icon: "Puzzle",
        title: "Integrazione",
        description: "API robuste per integrare con i tuoi sistemi esistenti"
      },
      {
        icon: "TrendingUp",
        title: "Scalabilità",
        description: "Soluzioni che crescono con la tua azienda"
      },
      {
        icon: "Clock",
        title: "Efficienza",
        description: "Risparmio di tempo e risorse con workflow ottimizzati"
      }
    ]
  },

  products: {
    title: "I nostri prodotti",
    subtitle: "Una suite completa di strumenti per ogni esigenza di produttività e analisi",
    ctaText: "Scopri di più",
    loginText: "Login"
  },

  solutions: {
    title: "Soluzioni per casi d'uso",
    subtitle: "Approcci specifici per le tue esigenze aziendali",
    cards: [
      {
        title: "Team Risk & AML",
        description: "Soluzioni complete per l'analisi del rischio e l'anti-money laundering",
        products: ["Toppery AML"],
        icon: "Shield"
      },
      {
        title: "Back-office Produttività",
        description: "Automatizzazione dei processi amministrativi e di reporting",
        products: ["Toppery Review", "TopText AI"],
        icon: "FileText"
      },
      {
        title: "Content & Media",
        description: "Strumenti per la gestione e ottimizzazione di contenuti multimediali",
        products: ["Toppery Image", "TopText"],
        icon: "Image"
      },
      {
        title: "Network & Security",
        description: "Monitoraggio e analisi della sicurezza di rete e IP",
        products: ["Toppery IP"],
        icon: "Globe"
      }
    ]
  },

  team: {
    title: "Il nostro team",
    subtitle: "Esperti in tecnologia e innovazione, uniti dalla passione per l'eccellenza",
    members: [
      {
        name: "Team Engineering",
        role: "Sviluppo & Architettura",
        expertise: ["React", "TypeScript", "Node.js", "Cloud"]
      },
      {
        name: "Team Data Science",
        role: "Analisi & Machine Learning",
        expertise: ["Python", "AI/ML", "Analytics", "Big Data"]
      },
      {
        name: "Team Product",
        role: "Design & UX",
        expertise: ["Figma", "User Research", "Product Strategy"]
      }
    ],
    stats: [
      {
        label: "Anni di esperienza",
        value: "10+",
        icon: "Award"
      },
      {
        label: "Progetti completati",
        value: "500+",
        icon: "Target"
      },
      {
        label: "Clienti soddisfatti",
        value: "200+",
        icon: "Users"
      },
      {
        label: "Crescita annua",
        value: "150%",
        icon: "TrendingUp"
      }
    ]
  },

  ecosystem: {
    title: "Ecosistema & Integrazioni",
    subtitle: "Compatibilità con le principali piattaforme e servizi cloud",
    description: "Le nostre soluzioni si integrano perfettamente con i tuoi sistemi esistenti attraverso API robuste e standard aperti.",
    integrations: [
      { name: "Chrome", type: "Browser" },
      { name: "REST API", type: "Integration" },
      { name: "Webhook", type: "Automation" },
      { name: "Cloud Storage", type: "Storage" }
    ]
  },

  testimonials: {
    title: "Cosa dicono i nostri clienti",
    subtitle: "Testimonianze da professionisti che hanno scelto Toppery",
    // TODO: Aggiungere testimonianze reali quando disponibili
    items: [
      {
        quote: "Toppery AML ha rivoluzionato il nostro processo di analisi del rischio, riducendo i tempi del 70%.",
        author: "Marco R., Risk Manager",
        company: "Banca Italiana"
      },
      {
        quote: "Gli strumenti di produttività di Toppery ci hanno permesso di automatizzare processi che prima richiedevano ore.",
        author: "Sara L., Operations Director",
        company: "TechCorp"
      }
    ]
  },

  cta: {
    title: "Pronto a trasformare la tua produttività?",
    subtitle: "Inizia oggi stesso con le nostre soluzioni",
    primaryCta: "Inizia ora",
    secondaryCta: "Contattaci",
    loginCta: "Login"
  },

  footer: {
    company: "Toppery",
    tagline: "Soluzioni avanzate per analisi e produttività",
    links: {
      products: "Prodotti",
      extensions: "Estensioni",
      privacy: "Privacy",
      terms: "Termini",
      contact: "Contatti"
    },
    copyright: "© 2025 Toppery. Tutti i diritti riservati."
  }
};

// Adapter per i prodotti esistenti da /extensions
export const productAdapter = {
  topperyAml: {
    id: "toppery-aml",
    title: "Toppery AML",
    description: "Analisi avanzata dei dati con riconoscimento intelligente dei pattern, perfetto per l'analisi AML/Fraud",
    category: "Analisi Finanziaria",
    icon: "DollarSign",
    color: "primary",
    features: [
      "Analisi avanzata dei dati finanziari",
      "Analisi del gameplay con visualizzazione dati",
      "Analisi IP completa",
      "Riconoscimento pattern intelligente"
    ],
    hasLogin: true,
    route: "/auth/login",
    externalUrl: null
  },
  
  topperyImage: {
    id: "toppery-image",
    title: "Toppery Image",
    description: "Strumenti avanzati di elaborazione e ottimizzazione delle immagini per la tua esperienza di navigazione",
    category: "Media & Content",
    icon: "Star",
    color: "blue",
    features: [
      "Ottimizzazione automatica delle immagini",
      "Elaborazione istantanea",
      "Conversione formato",
      "Elaborazione batch"
    ],
    hasLogin: false,
    route: "/extensions/toppery-image",
    externalUrl: "https://get.toppery.work/toppery-image"
  },
  
  topperyIp: {
    id: "toppery-ip",
    title: "Toppery IP",
    description: "Strumenti di gestione IP e analisi di rete progettati per utenti avanzati che necessitano di insight completi sulla rete",
    category: "Network & Security",
    icon: "Globe",
    color: "purple",
    features: [
      "Analisi IP avanzata",
      "Monitoraggio di rete",
      "Insight sulla sicurezza",
      "Geolocalizzazione IP"
    ],
    hasLogin: false,
    route: "/extensions/toppery-ip",
    externalUrl: "https://get.toppery.work/toppery-ip"
  },
  
  topTextAi: {
    id: "toptext-ai",
    title: "TopText AI",
    description: "Generazione di testo basata su AI e assistenza intelligente alla scrittura che trasforma la tua creazione di contenuti",
    category: "AI & Content",
    icon: "Zap",
    color: "yellow",
    features: [
      "Assistente di scrittura AI",
      "Completamento intelligente",
      "Miglioramento contenuti",
      "Consapevolezza del contesto"
    ],
    hasLogin: false,
    route: "/extensions/toptext-ai",
    externalUrl: "https://get.toppery.work/toptext-ai"
  },
  
  topText: {
    id: "toptext",
    title: "TopText",
    description: "Strumenti intelligenti di miglioramento e formattazione del testo che rivoluzionano la tua creazione di contenuti",
    category: "Content & Text",
    icon: "Shield",
    color: "green",
    features: [
      "Formattazione testo avanzata",
      "Editing intelligente",
      "Copia rapida",
      "Controllo grammaticale"
    ],
    hasLogin: false,
    route: "/extensions/toptext",
    externalUrl: "https://get.toppery.work/toptext"
  },
  
  topperyReview: {
    id: "toppery-review",
    title: "Toppery Review",
    description: "Genera automaticamente recensioni complete e dettagliate dei giocatori, risparmiando tempo e migliorando l'accuratezza",
    category: "Analisi & Reporting",
    icon: "FileText",
    color: "primary",
    features: [
      "Generazione automatica report",
      "Template recensioni personalizzabili",
      "Integrazione con dati di analisi",
      "Workflow ottimizzato"
    ],
    hasLogin: false,
    route: "/review",
    externalUrl: null
  }
};

// Funzione helper per ottenere tutti i prodotti
export const getAllProducts = () => {
  return Object.values(productAdapter);
};

// Funzione helper per ottenere prodotti per categoria
export const getProductsByCategory = (category: string) => {
  return Object.values(productAdapter).filter(product => 
    product.category.toLowerCase().includes(category.toLowerCase())
  );
};
