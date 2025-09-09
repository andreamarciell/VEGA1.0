import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentSession } from "@/lib/auth";
import ReviewWizard from "@/features/review/components/ReviewWizard";

export default function ReviewGenerator() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  // Function to clear review form state
  const clearReviewState = () => {
    localStorage.removeItem('review-generator-state');
  };

  // Handle navigation back to dashboard
  const handleNavigateToDashboard = () => {
    clearReviewState();
    navigate('/dashboard');
  };

  // Handle page refresh/close
  useEffect(() => {
    const handleBeforeUnload = () => {
      clearReviewState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearReviewState();
      }
    };

    // Clear state when page is refreshed or closed
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const session = await getCurrentSession();
        if (!session) {
          navigate("/auth/login", { replace: true });
          return;
        }
      } finally {
        setChecking(false);
      }
    };
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) return null;

  return (
    <div className="min-h-screen bg-background">
      <button
        onClick={handleNavigateToDashboard}
        className="fixed top-4 right-4 z-50 px-4 py-2 rounded-md bg-blue-600 text-white shadow hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
      >
        Torna alla Dashboard
      </button>

      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-semibold mb-6">Toppery Review Generator</h1>
        <ReviewWizard />
      </div>
    </div>
  );
}