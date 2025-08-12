import React from 'react';
import { FormProvider } from '../context/FormContext';
import SideNav from './SideNav';
import ReviewTypeSelector from './SectionForms/ReviewTypeSelector';
import AgentDateForm from './SectionForms/AgentDateForm';
import CustomerProfileForm from './SectionForms/CustomerProfileForm';
import ReputationalIndicatorsForm from './SectionForms/ReputationalIndicatorsForm';
import ConclusionForm from './SectionForms/ConclusionForm';
import AttachmentsForm from './SectionForms/AttachmentsForm';
import ReasonForReviewForm from './SectionForms/ReasonForReviewForm';
import ReviewPerformedByForm from './SectionForms/ReviewPerformedByForm';
import PaymentMethodsForm from './SectionForms/PaymentMethodsForm';
import ActivityForm from './SectionForms/ActivityForm';
import SourceOfFundsForm from './SectionForms/SourceOfFundsForm';
import ConclusionRiskLevelForm from './SectionForms/ConclusionRiskLevelForm';
import FollowUpActionsForm from './SectionForms/FollowUpActionsForm';
import BackgroundInformationForm from './SectionForms/BackgroundInformationForm';
import ExportSummary from './SectionForms/ExportSummary';
import AddActivityForm from './SectionForms/AddActivityForm';
import ReputationalIndicatorsFullForm from './SectionForms/ReputationalIndicatorsFullForm';
import { useFormContext } from '../context/FormContext';

interface ReviewWizardProps {
  onComplete?: (docxBlob: Blob) => void;
}

function ReviewWizardContent({ onComplete }: ReviewWizardProps) {
  const { state } = useFormContext();

  const renderCurrentSection = () => {
    switch (state.currentSection) {
      case 'review-type':
        return <ReviewTypeSelector />;
      
      // Adverse Review sections
      case 'agent-date':
        return <AgentDateForm />;
      case 'customer-profile':
        return <CustomerProfileForm />;
      case 'reputational-indicators':
        return <ReputationalIndicatorsForm />;
      case 'conclusion':
        return <ConclusionForm />;
      case 'attachments':
        return <AttachmentsForm />;
      
      // Full Review sections
      case 'reason':
        return <ReasonForReviewForm />;
      case 'review-performed-by':
        return <ReviewPerformedByForm />;
      case 'customer-profile-full':
        return <CustomerProfileForm />;
      case 'payment-methods':
        return <PaymentMethodsForm />;
      case 'activity':
        return <ActivityForm />;
      case 'add-activity':
        return <AddActivityForm />;
      case 'source-of-funds':
        return <SourceOfFundsForm />;
      case 'reputational-indicators-full':
        return <ReputationalIndicatorsFullForm />;
      case 'conclusion-risk-level':
        return <ConclusionRiskLevelForm />;
      case 'follow-up-actions':
        return <FollowUpActionsForm />;
      case 'background-information':
        return <BackgroundInformationForm />;
      
      case 'export':
        return <ExportSummary onComplete={onComplete} />;
      
      default:
        return <ReviewTypeSelector />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <SideNav />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          {renderCurrentSection()}
        </div>
      </main>
    </div>
  );
}

export default function ReviewWizard({ onComplete }: ReviewWizardProps) {
  return (
    <FormProvider>
      <ReviewWizardContent onComplete={onComplete} />
    </FormProvider>
  );
}