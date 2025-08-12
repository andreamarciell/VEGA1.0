import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentSession } from "@/lib/auth";
import ReviewWizard from "@/features/review/components/ReviewWizard";

export default function ReviewGenerator() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

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
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-semibold mb-6">Toppery Review Generator</h1>
        <ReviewWizard />
      </div>
    </div>
  );
}