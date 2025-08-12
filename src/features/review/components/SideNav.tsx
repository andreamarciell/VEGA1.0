import React from 'react';
import { useFormContext } from '../context/FormContext';
import { Check, FileText, User, Building, AlertTriangle, CheckCircle, Target, CreditCard, Activity, DollarSign, Shield, Users, FileCheck, Download, Plus } from 'lucide-react';

const adverseSections = [
  { id: 'review-type', label: 'Tipo di Review', icon: FileText },
  { id: 'agent-date', label: 'Agente & Data', icon: User },
  { id: 'customer-profile', label: 'Profilo Cliente', icon: Building },
  { id: 'reputational-indicators', label: 'Indicatori Reputazionali', icon: AlertTriangle },
  { id: 'conclusion', label: 'Conclusione', icon: CheckCircle },
  { id: 'export', label: 'Esporta', icon: Download }
];

const fullSections = [
  { id: 'review-type', label: 'Tipo di Review', icon: FileText },
  { id: 'reason', label: 'Motivo della Review', icon: Target },
  { id: 'review-performed-by', label: 'Review Eseguita da & Data', icon: User },
  { id: 'customer-profile-full', label: 'Profilo Cliente', icon: Building },
  { id: 'payment-methods', label: 'Metodi di Pagamento', icon: CreditCard },
  { id: 'activity', label: 'Terze Parti', icon: Activity },
  { id: 'add-activity', label: 'Gameplay', icon: Plus },
  { id: 'source-of-funds', label: 'Fonte dei Fondi', icon: DollarSign },
  { id: 'reputational-indicators-full', label: 'Indicatori Reputazionali', icon: AlertTriangle },
  { id: 'conclusion-risk-level', label: 'Conclusione & Livello di Rischio', icon: CheckCircle },
  { id: 'follow-up-actions', label: 'Azioni di Follow-up', icon: FileCheck },
  { id: 'background-information', label: 'Informazioni di Background', icon: Users },
  { id: 'export', label: 'Esporta', icon: Download }
];

export default function SideNav() {
  const { resetForm } = useFormContext();
  const { state, setCurrentSection } = useFormContext();
  
  const sections = state.reviewType === 'adverse' ? adverseSections : 
                  state.reviewType === 'full' ? fullSections : 
                  [adverseSections[0]]; // Only show review type selector initially

  return (
    <div className="w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Review Generator</h1>
        {state.reviewType && (
          <p className="text-sm text-gray-600">
            {state.reviewType === 'adverse' ? 'Adverse Media Review' : 'Full Review'}
          </p>
        )}
      </div>

      <nav className="space-y-2">
        {sections.map((section) => {
          const isActive = state.currentSection === section.id;
          const isCompleted = state.completedSections[section.id];
          const Icon = section.icon;

          return (
            <button
              key={section.id}
              onClick={() => setCurrentSection(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
              disabled={!state.reviewType && section.id !== 'review-type'}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                {isCompleted && (
                  <Check className="w-3 h-3 text-green-600 absolute -top-1 -right-1 bg-white rounded-full" />
                )}
              </div>
              <span className={`text-sm font-medium ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>
                {section.label}
              </span>
            </button>
          );
        })}
      </nav>

      {state.reviewType && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={() => {
              if (confirm('Sei sicuro di voler resettare tutti i dati?')) {
                resetForm();
              }
            }}
            className="text-sm text-red-600 hover:text-red-700 transition-colors"
          >
            Reset Form
          </button>
                    <button 
            onClick={() => navigate('/dashboard')} 
            variant="outline" 
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      )}
    </div>
  );
}
