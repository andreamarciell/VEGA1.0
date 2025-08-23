import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

export type ReviewType = 'adverse' | 'full';

export interface CustomerProfile {
  registrationDate: string;
  documentsSent: Array<{
    document: string;
    status: string;
    info: string;
  }>;
  firstDeposit: string;
  totalDeposited: string;
  totalWithdrawn: string;
  balance: string;
  age: string;
  nationality: string;
  birthplace: string;
  accessAttempts: string;
  activityBetween22And6: string;
  accountHistory: string;
}

export interface PaymentMethod {
  nameNumber: string;
  type: string;
  additionalInfo: string;
}

export interface ThirdPartyPaymentMethod {
  nameNumber: string;
  type: string;
  additionalInfo: string;
}

export interface AdditionalActivity {
  type: string;
  additionalInfo: string;
}

export interface ActivityRecord {
  date: string;
  type: string;
  amount: string;
  description: string;
}

export interface BackgroundInfo {
  source: string;
  type: string;
  additionalInfo: string;
}
export interface Attachment {
  name: string;
  dataUrl: string;
}


export interface AdverseReviewData {
  agentName: string;
  reviewDate: string;
  customerProfile: CustomerProfile;
  reputationalIndicators: string;
    reputationalSources: { author: string; url: string }[];
  conclusion: string;
  attachments: Attachment[];
}

export interface FullReviewData {
  reasonForReview: string;
  reviewPerformedBy: string;
  reviewDate: string;
  customerProfile: CustomerProfile;
  paymentMethods: PaymentMethod[];
  thirdPartyPaymentMethods: ThirdPartyPaymentMethod[];
  additionalActivities: AdditionalActivity[];
  sourceOfFunds: {
    primary: string;
    secondary: string;
    documentation: string;
  };
  reputationalIndicators: string;
  reputationalIndicatorCheck: string;
  conclusionAndRiskLevel: string;
  followUpActions: string;
  backgroundInformation: BackgroundInfo[];
  attachments: Attachment[];
}

export interface FormState {
  reviewType: ReviewType | null;
  adverseData: AdverseReviewData;
  fullData: FullReviewData;
  completedSections: Record<string, boolean>;
  currentSection: string;
}

type FormAction =
  | { type: 'SET_REVIEW_TYPE'; payload: ReviewType }
  | { type: 'UPDATE_ADVERSE_DATA'; payload: Partial<AdverseReviewData> }
  | { type: 'UPDATE_FULL_DATA'; payload: Partial<FullReviewData> }
  | { type: 'MARK_SECTION_COMPLETE'; payload: { section: string; complete: boolean } }
  | { type: 'SET_CURRENT_SECTION'; payload: string }
  | { type: 'LOAD_FROM_STORAGE'; payload: FormState }
  | { type: 'RESET_FORM' };

const initialCustomerProfile: CustomerProfile = {
  registrationDate: '',
  documentsSent: [],
  firstDeposit: '',
  totalDeposited: '',
  totalWithdrawn: '',
  balance: '',
  age: '',
  nationality: '',
  birthplace: '',
  accessAttempts: '',
  activityBetween22And6: '',
  accountHistory: '',
latestLogin: '', latestLoginIP: '', latestLoginNationality: '', latestLoginNationalityOther: '',
};

const initialState: FormState = {
  reviewType: null,
  adverseData: {
    agentName: '',
    reviewDate: new Date().toISOString().slice(0,10),
    customerProfile: initialCustomerProfile,
    reputationalIndicators: '',
    reputationalSources: [],
    conclusion: ''
    ,
    attachments: []
  },
  fullData: {
    reasonForReview: '',
    reviewPerformedBy: '',
    reviewDate: '',
    customerProfile: initialCustomerProfile,
    paymentMethods: [],
    thirdPartyPaymentMethods: [],
    additionalActivities: [],
    sourceOfFunds: {
      primary: '',
      secondary: '',
      documentation: ''
    },
    reputationalIndicators: '',
    reputationalIndicatorCheck: '',
    conclusionAndRiskLevel: '',
    followUpActions: '',
    backgroundInformation: [],
    attachments: []
  },
  completedSections: {},
  currentSection: 'review-type'
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_REVIEW_TYPE':
      return {
        ...state,
        reviewType: action.payload,
        currentSection: action.payload === 'adverse' ? 'agent-date' : 'reason'
      };
    case 'UPDATE_ADVERSE_DATA':
      return {
        ...state,
        adverseData: { ...state.adverseData, ...action.payload }
      };
    case 'UPDATE_FULL_DATA':
      return {
        ...state,
        fullData: { ...state.fullData, ...action.payload }
      };
    case 'MARK_SECTION_COMPLETE':
      return {
        ...state,
        completedSections: {
          ...state.completedSections,
          [action.payload.section]: action.payload.complete
        }
      };
    case 'SET_CURRENT_SECTION':
      return {
        ...state,
        currentSection: action.payload
      };
    case 'LOAD_FROM_STORAGE':
      return action.payload;
    case 'RESET_FORM':
      return initialState;
    default:
      return state;
  }
}

interface FormContextType {
  state: FormState;
  dispatch: React.Dispatch<FormAction>;
  updateAdverseData: (data: Partial<AdverseReviewData>) => void;
  updateFullData: (data: Partial<FullReviewData>) => void;
  markSectionComplete: (section: string, complete: boolean) => void;
  setCurrentSection: (section: string) => void;
  resetForm: () => void;
}

const FormContext = createContext<FormContextType | null>(null);

export function FormProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(formReducer, initialState);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('review-generator-state');
    if (saved) {
      try {
        const parsedState = JSON.parse(saved);
        dispatch({ type: 'LOAD_FROM_STORAGE', payload: parsedState });
      } catch (error) {
        console.error('Failed to load saved state:', error);
      }
    }
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('review-generator-state', JSON.stringify(state));
  }, [state]);

  const updateAdverseData = (data: Partial<AdverseReviewData>) => {
    dispatch({ type: 'UPDATE_ADVERSE_DATA', payload: data });
  };

  const updateFullData = (data: Partial<FullReviewData>) => {
    dispatch({ type: 'UPDATE_FULL_DATA', payload: data });
  };

  const markSectionComplete = (section: string, complete: boolean) => {
    dispatch({ type: 'MARK_SECTION_COMPLETE', payload: { section, complete } });
  };

  const setCurrentSection = (section: string) => {
    dispatch({ type: 'SET_CURRENT_SECTION', payload: section });
  };

  const resetForm = () => {
    localStorage.removeItem('review-generator-state');
    dispatch({ type: 'RESET_FORM' });
  };

  return (
    <FormContext.Provider
      value={{
        state,
        dispatch,
        updateAdverseData,
        updateFullData,
        markSectionComplete,
        setCurrentSection,
        resetForm
      }}
    >
      {children}
    </FormContext.Provider>
  );
}

export function useFormContext() {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('useFormContext must be used within a FormProvider');
  }
  return context;
}