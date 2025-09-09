import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUserAnalytics } from "@/lib/adminAuth";
import { 
  Users, 
  UserCheck, 
  Calendar,
  TrendingUp,
  AlertTriangle,
  Shield
} from "lucide-react";

interface AnalyticsData {
  total_users: number;
  users_created_today: number;
  users_created_this_week: number;
  users_created_this_month: number;
  users_with_failed_logins: number;
  locked_accounts: number;
}

export const AdminAnalytics = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        const data = await getUserAnalytics();
        setAnalytics(data as unknown as AnalyticsData);
        setError(null);
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError('Failed to load analytics data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-muted rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
            <p className="text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return null;
  }

  const stats = [
    {
      title: "Total Users",
      value: analytics.total_users,
      icon: Users,
      description: "Registered users",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950"
    },
    {
      title: "New Today",
      value: analytics.users_created_today,
      icon: UserCheck,
      description: "Users registered today",
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950"
    },
    {
      title: "This Week",
      value: analytics.users_created_this_week,
      icon: TrendingUp,
      description: "Users registered this week",
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950"
    },
    {
      title: "This Month",
      value: analytics.users_created_this_month,
      icon: Calendar,
      description: "Users registered this month",
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950"
    },
    {
      title: "Failed Logins",
      value: analytics.users_with_failed_logins,
      icon: AlertTriangle,
      description: "Users with failed login attempts",
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950",
      alert: analytics.users_with_failed_logins > 0
    },
    {
      title: "Locked Accounts",
      value: analytics.locked_accounts,
      icon: Shield,
      description: "Currently locked accounts",
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950",
      alert: analytics.locked_accounts > 0
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">System Analytics</h2>
        <Badge variant="outline" className="text-xs">
          Real-time data
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="relative overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  {stat.alert && (
                    <Badge variant="destructive" className="text-xs">
                      Alert
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground">
                      {stat.description}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.bgColor}`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(analytics.users_with_failed_logins > 0 || analytics.locked_accounts > 0) && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Security Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analytics.users_with_failed_logins > 0 && (
              <p className="text-sm">
                <strong>{analytics.users_with_failed_logins}</strong> users have failed login attempts
              </p>
            )}
            {analytics.locked_accounts > 0 && (
              <p className="text-sm">
                <strong>{analytics.locked_accounts}</strong> accounts are currently locked
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};