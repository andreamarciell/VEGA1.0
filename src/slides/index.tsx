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
import { TitleSlide } from '../components/presentation/slides/TitleSlide';
import { FeatureSlide } from '../components/presentation/slides/FeatureSlide';
import { ContentSlide } from '../components/presentation/slides/ContentSlide';
import { ImageSlide } from './components/ImageSlide';
import { Feature, Extension } from '../types';

// Define features for different sections
const amlFeatures: Feature[] = [
  {
    icon: <Upload className="w-8 h-8 text-blue-600" />,
    title: "Upload & Analysis",
    description: "Upload Excel/CSV files for automatic AML analysis",
    details: [
      "Support for Excel and CSV formats",
      "Automatic data parsing",
      "Format validation",
      "Advanced error handling"
    ]
  },
  {
    icon: <BarChart3 className="w-8 h-8 text-green-600" />,
    title: "Advanced Analysis",
    description: "Sophisticated algorithms to detect suspicious patterns",
    details: [
      "Detection of split transactions",
      "Night session analysis",
      "Risk score calculation",
      "Pattern recognition"
    ]
  },
  {
    icon: <Eye className="w-8 h-8 text-purple-600" />,
    title: "Interactive Dashboard",
    description: "Complete visualization of results",
    details: [
      "Interactive charts",
      "Detailed tables",
      "Advanced filters"
    ]
  },
];

const reviewFeatures: Feature[] = [
  {
    icon: <FileText className="w-8 h-8 text-blue-600" />,
    title: "Report Generator",
    description: "Automatic creation of professional AML reports",
    details: [
      "Predefined templates",
      "Content customization",
      "Word export",
      "Automatic formatting"
    ]
  },
  {
    icon: <Settings className="w-8 h-8 text-green-600" />,
    title: "Advanced Configuration",
    description: "Complete report customization",
    details: [
      "WYSIWYG editor",
      "Custom templates",
      "Dynamic variables",
      "Real-time preview"
    ]
  }
];

const adminFeatures: Feature[] = [
  {
    icon: <Users className="w-8 h-8 text-blue-600" />,
    title: "User Management",
    description: "Complete control of system users",
    details: [
      "Create new users",
      "Modify credentials",
      "Permission management",
      "Activity monitoring"
    ]
  },
  {
    icon: <BarChart3 className="w-8 h-8 text-green-600" />,
    title: "Advanced Analytics",
    description: "Detailed usage statistics",
    details: [
      "Usage metrics",
      "Time-based charts",
      "Performance reports",
      "Data export"
    ]
  },
  {
    icon: <Shield className="w-8 h-8 text-purple-600" />,
    title: "Security",
    description: "Advanced security system",
    details: [
      "Account lockout",
      "Security logs",
      "Strong authentication",
      "Access monitoring"
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
    description: "Automatic lockout system for failed attempts",
    details: [
      "Temporary account lock",
      "Unlock timer",
      "Security notifications",
      "Detailed logs"
    ]
  },
  {
    icon: <Shield className="w-8 h-8 text-blue-600" />,
    title: "Secure Authentication",
    description: "Robust and secure login system",
    details: [
      "Password hashing",
      "Session management",
      "CSRF protection",
      "Secure cookies"
    ]
  },
  {
    icon: <AlertTriangle className="w-8 h-8 text-orange-600" />,
    title: "Security Monitoring",
    description: "Continuous monitoring of suspicious activities",
    details: [
      "Security logs",
      "Automatic alerts",
      "Pattern analysis",
      "Incident reports"
    ]
  }
];

export const slides = [
  // Slide 1: Title
  {
    id: 'title',
    title: 'TopperyAML',
    subtitle: 'Advanced AML Analysis System',
    content: (
      <TitleSlide
        title="TopperyAML"
        subtitle="Advanced AML Analysis System"
        description="Complete platform for Anti-Money Laundering analysis with advanced detection tools, reporting and user management."
      />
    ),
    type: 'title' as const
  },

  // Slide 2: Overview
  {
    id: 'overview',
    title: 'System Overview',
    subtitle: 'A complete solution for AML analysis',
    content: (
      <ContentSlide
        title="System Overview"
        subtitle="A complete solution for AML analysis"
        content={
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-primary">🎯 Objective</h3>
                <p className="text-lg text-muted-foreground">
                  Provide advanced tools for the analysis and detection of suspicious 
                  money laundering activities through sophisticated algorithms and 
                  intuitive interfaces.
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-primary">🚀 Technologies</h3>
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
              <h3 className="text-xl font-semibold mb-3">✨ Key Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Automatic analysis</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Interactive dashboard</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>User management</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Advanced security</span>
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
    title: 'AML Dashboard',
    subtitle: 'Advanced analysis and suspicious pattern detection',
    content: (
      <FeatureSlide
        title="AML Dashboard"
        subtitle="Advanced analysis and suspicious pattern detection"
        features={amlFeatures}
        layout="grid"
      />
    ),
    type: 'feature' as const
  },

  // Slide 4: AML Dashboard Screenshot
  {
    id: 'aml-dashboard',
    title: 'AML Dashboard',
    subtitle: 'Main interface of the analysis system',
    content: (
      <ImageSlide
        title="AML Dashboard"
        subtitle="Main interface of the analysis system"
        imagePath="/screenshots2/screencapture-toppery-work-toppery-aml-2025-09-26-21_03_02.png"
        imageAlt="TopperyAML main dashboard"
      />
    ),
    type: 'demo' as const
  },

  // Slide 5: AML Analysis Screenshot
  {
    id: 'aml-analysis',
    title: 'AML Analysis in Action',
    subtitle: 'Analysis process and suspicious pattern detection',
    content: (
      <ImageSlide
        title="AML Analysis in Action"
        subtitle="Analysis process and suspicious pattern detection"
        imagePath="/screenshots2/screencapture-toppery-work-toppery-aml-2025-09-26-21_03_32.png"
        imageAlt="AML analysis with charts and metrics"
        description="This page shows the split transactions identified by the system, with a complete summary of the user's risk profile based on the detected behavior patterns."
      />
    ),
    type: 'demo' as const
  },

  // Slide 6: AML Results Screenshot
  {
    id: 'aml-results',
    title: 'Analysis Results',
    subtitle: 'Detailed visualization of AML results',
    content: (
      <ImageSlide
        title="Analysis Results"
        subtitle="Detailed visualization of AML results"
        imagePath="/screenshots2/screencapture-toppery-work-toppery-aml-2025-09-26-21_03_56.png"
        imageAlt="Detailed AML analysis results"
        description="The 'Night Sessions' page shows a calculation based on the user's identified night activity, analyzing gameplay patterns during night hours to identify suspicious behaviors."
      />
    ),
    type: 'demo' as const
  },

  // Slide 7: Advanced Analysis Screenshot
  {
    id: 'aml-advanced',
    title: 'Advanced Analysis',
    subtitle: 'Advanced AML analysis features',
    content: (
      <ImageSlide
        title="Advanced Analysis"
        subtitle="Advanced AML analysis features"
        imagePath="/screenshots2/screencapture-toppery-work-toppery-aml-2025-09-26-21_04_06.png"
        imageAlt="Advanced AML analysis"
        description="The 'Charts' page presents a complete visualization of the user's gameplay and general activity through interactive charts showing behavior patterns, gaming sessions and temporal trends."
      />
    ),
    type: 'demo' as const
  },

  // Slide 8: Review Generator Screenshot
  {
    id: 'review-generator',
    title: 'AI Analysis',
    subtitle: 'Automatic creation of professional reports',
    content: (
      <ImageSlide
        title="AI Analysis"
        subtitle="Automatic creation of professional reports"
        imagePath="/screenshots2/new1.png"
        imageAlt="AML report generator"
        description="The 'AI Analysis' page anonymizes user data, sending only information related to gameplay and transactions without sensitive identifiers such as nickname. The AI generates summaries and charts, with a chatbot to request additional information about the activity."
      />
    ),
    type: 'demo' as const
  },

  // Slide 9: Admin Panel Screenshot
  {
    id: 'admin-panel',
    title: 'Transaction Analysis',
    subtitle: 'Complete analysis of user transactions',
    content: (
      <ImageSlide
        title="Transaction Analysis"
        subtitle="Complete analysis of user transactions"
        imagePath="/screenshots2/screencapture-toppery-work-toppery-aml-2025-09-26-21_05_30.png"
        imageAlt="Administrator panel"
        description="The 'Transactions' page analyzes imported Excel files of deposits and withdrawals, generating a summary of all payment methods used and creating charts to better visualize the user's financial activity."
      />
    ),
    type: 'demo' as const
  },

  // Slide 10: Security Features Screenshot
  {
    id: 'security-features',
    title: 'Gameplay Analysis',
    subtitle: 'Summary of player gameplay with the most relevant movements',
    content: (
      <ImageSlide
        title="Gameplay Analysis"
        subtitle="Summary of player gameplay with the most relevant movements"
        imagePath="/screenshots2/new2.png"
        imageAlt="Advanced security system"
        description="The 'Important Movements' page identifies and analyzes movements with the highest amounts, showing a detailed summary of what happened before and after the identified movement to better understand the context of significant transactions."
      />
    ),
    type: 'demo' as const
  },

  // Slide 11: System Overview Screenshot
  {
    id: 'system-overview',
    title: 'Access Analysis',
    subtitle: 'Analysis of user IP accesses',
    content: (
      <ImageSlide
        title="Access Analysis"
        subtitle="Analysis of user IP accesses"
        imagePath="/screenshots2/screencapture-toppery-work-toppery-aml-2025-09-26-21_06_20.png"
        imageAlt="TopperyAML system overview"
        description="The 'Accesses' page analyzes the player's IP Excel files, examining IP addresses and displaying detailed information regarding the user's geographic location and access patterns."
      />
    ),
    type: 'demo' as const
  },


  // Slide 13: Technical Architecture
  {
    id: 'architecture',
    title: 'Technical Architecture',
    subtitle: 'Technology stack and system architecture',
    content: (
      <ContentSlide
        title="Technical Architecture"
        subtitle="Technology stack and system architecture"
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
    title: 'Conclusion',
    subtitle: 'TopperyAML: The complete solution for AML analysis',
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
              
              <h1 className="slide-title mb-6">Thank you for your attention!</h1>
              <p className="text-2xl text-muted-foreground mb-8">
                TopperyAML: The complete solution for AML analysis
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="max-w-4xl mx-auto"
            >
              <div className="text-center mb-8">
                <h3 className="text-3xl font-semibold text-primary mb-6">🎯 Key Benefits</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>Advanced automatic analysis</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>Intuitive interface</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>Enterprise security</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>Professional reports</span>
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
                  href="https://toppery.work" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-8 py-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-lg font-semibold shadow-lg hover:shadow-xl"
                >
                  <ExternalLink className="w-5 h-5 mr-3" />
                  Try TopperyAML
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
