import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Save, RefreshCw, Settings, ArrowLeft } from "lucide-react";
import { api, apiResponse } from "@/lib/apiClient";

interface RiskConfig {
  volume_thresholds?: {
    value: {
      daily: number;
      weekly: number;
      monthly: number;
    };
    description?: string;
  };
  risk_motivations?: {
    value: {
      frazionate: {
        name: string;
        weight: 'base' | 'major' | 'minor';
        enabled: boolean;
      };
      bonus_concentration: {
        name: string;
        weight: 'base' | 'major' | 'minor';
        threshold_percentage: number;
        enabled: boolean;
      };
      casino_live: {
        name: string;
        weight: 'base' | 'major' | 'minor';
        threshold_percentage: number;
        enabled: boolean;
      };
      volumes_daily: {
        name: string;
        weight: 'base' | 'major' | 'minor';
        enabled: boolean;
      };
      volumes_weekly: {
        name: string;
        weight: 'base' | 'major' | 'minor';
        enabled: boolean;
      };
      volumes_monthly: {
        name: string;
        weight: 'base' | 'major' | 'minor';
        enabled: boolean;
      };
    };
    description?: string;
  };
  risk_levels?: {
    value: {
      base_levels: {
        monthly_exceeded: string;
        weekly_or_daily_exceeded: string;
        default: string;
      };
      escalation_rules: {
        [key: string]: {
          [key: string]: string;
        };
      };
      score_mapping: {
        [key: string]: number;
      };
    };
    description?: string;
  };
}

export default function SuperAdminRiskConfig() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [config, setConfig] = useState<RiskConfig>({});
  const [tenant, setTenant] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchConfig();
    }
  }, [tenantId]);

  // Default AML risk configuration values
  const getDefaultConfig = (): RiskConfig => ({
    volume_thresholds: {
      value: {
        daily: 5000,
        weekly: 10000,
        monthly: 15000
      },
      description: 'Soglie per volumi depositi/prelievi (in EUR)'
    },
    risk_motivations: {
      value: {
        frazionate: {
          name: "Rilevato structuring tramite operazioni frazionate.",
          weight: "major",
          enabled: true
        },
        bonus_concentration: {
          name: "Rilevata concentrazione di bonus.",
          weight: "major",
          threshold_percentage: 10,
          enabled: true
        },
        casino_live: {
          name: "Rilevata attività significativa su casino live.",
          weight: "minor",
          threshold_percentage: 40,
          enabled: true
        },
        volumes_daily: {
          name: "Rilevati volumi significativamente elevati su base giornaliera",
          weight: "base",
          enabled: true
        },
        volumes_weekly: {
          name: "Rilevati volumi significativamente elevati su base settimanale",
          weight: "base",
          enabled: true
        },
        volumes_monthly: {
          name: "Rilevati volumi significativamente elevati su base mensile",
          weight: "base",
          enabled: true
        }
      },
      description: 'Configurazione motivazioni di rischio'
    },
    risk_levels: {
      value: {
        base_levels: {
          monthly_exceeded: "High",
          weekly_or_daily_exceeded: "Medium",
          default: "Low"
        },
        escalation_rules: {
          Low: {
            major_aggravants: "High",
            minor_aggravants: "Medium"
          },
          Medium: {
            major_aggravants: "High"
          },
          High: {
            any_aggravants: "Elevato"
          }
        },
        score_mapping: {
          Elevato: 100,
          High: 80,
          Medium: 50,
          Low: 20
        }
      },
      description: 'Configurazione livelli e escalation del rischio'
    }
  });

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(
        `/api/v1/super-admin/tenants/${tenantId}/risk-config`,
        getToken
      );

      const data = await apiResponse(response);
      
      // If config is empty or missing, initialize with defaults
      if (!data.config || Object.keys(data.config).length === 0) {
        const defaultConfig = getDefaultConfig();
        setConfig(defaultConfig);
        setTenant(data.tenant);
        toast({
          title: "Default Configuration Loaded",
          description: "No configuration found. Using default AML values.",
        });
      } else {
        setConfig(data.config);
        setTenant(data.tenant);
      }
    } catch (error: any) {
      console.error('Error fetching config:', error);
      // If error, initialize with defaults
      const defaultConfig = getDefaultConfig();
      setConfig(defaultConfig);
      toast({
        title: "Warning",
        description: error.message || "Failed to load configuration. Using defaults.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async (configKey: string, configValue: any, description?: string) => {
    try {
      setIsSaving(true);
      const response = await api.put(
        `/api/v1/super-admin/tenants/${tenantId}/risk-config`,
        {
          configKey,
          configValue,
          description,
        },
        getToken
      );

      await apiResponse(response);

      toast({
        title: "Configuration Saved",
        description: `${configKey} has been updated successfully.`,
      });
      
      await fetchConfig();
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateVolumeThresholds = (field: 'daily' | 'weekly' | 'monthly', value: number) => {
    if (!config.volume_thresholds?.value) return;
    
    const updated = {
      ...config.volume_thresholds.value,
      [field]: value,
    };
    
    setConfig({
      ...config,
      volume_thresholds: {
        ...config.volume_thresholds,
        value: updated,
      },
    });
  };

  const updateRiskMotivation = (key: string, field: string, value: any) => {
    if (!config.risk_motivations?.value) return;
    
    const updated = {
      ...config.risk_motivations.value,
      [key]: {
        ...config.risk_motivations.value[key as keyof typeof config.risk_motivations.value],
        [field]: value,
      },
    };
    
    setConfig({
      ...config,
      risk_motivations: {
        ...config.risk_motivations,
        value: updated,
      },
    });
  };

  const updateRiskLevels = (section: string, key: string, value: any) => {
    if (!config.risk_levels?.value) return;
    
    let updated: any;
    if (section === 'base_levels') {
      updated = {
        ...config.risk_levels.value,
        base_levels: {
          ...config.risk_levels.value.base_levels,
          [key]: value,
        },
      };
    } else if (section === 'score_mapping') {
      updated = {
        ...config.risk_levels.value,
        score_mapping: {
          ...config.risk_levels.value.score_mapping,
          [key]: value,
        },
      };
    } else {
      updated = {
        ...config.risk_levels.value,
        escalation_rules: {
          ...config.risk_levels.value.escalation_rules,
          [key]: value,
        },
      };
    }
    
    setConfig({
      ...config,
      risk_levels: {
        ...config.risk_levels,
        value: updated,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading configuration...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate('/super-admin')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Risk Engine Configuration</h1>
              <p className="text-muted-foreground">
                {tenant?.display_name} ({tenant?.db_name})
              </p>
            </div>
          </div>
          <Button onClick={fetchConfig} variant="outline" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="thresholds" className="space-y-4">
          <TabsList>
            <TabsTrigger value="thresholds">Volume Thresholds</TabsTrigger>
            <TabsTrigger value="motivations">Risk Motivations</TabsTrigger>
            <TabsTrigger value="levels">Risk Levels</TabsTrigger>
          </TabsList>

          <TabsContent value="thresholds">
            <Card>
              <CardHeader>
                <CardTitle>Volume Thresholds</CardTitle>
                <CardDescription>
                  Set the thresholds for daily, weekly, and monthly deposit/withdrawal volumes (in EUR)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="daily">Daily Threshold (€)</Label>
                    <Input
                      id="daily"
                      type="number"
                      value={config.volume_thresholds?.value?.daily || 0}
                      onChange={(e) => updateVolumeThresholds('daily', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weekly">Weekly Threshold (€)</Label>
                    <Input
                      id="weekly"
                      type="number"
                      value={config.volume_thresholds?.value?.weekly || 0}
                      onChange={(e) => updateVolumeThresholds('weekly', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthly">Monthly Threshold (€)</Label>
                    <Input
                      id="monthly"
                      type="number"
                      value={config.volume_thresholds?.value?.monthly || 0}
                      onChange={(e) => updateVolumeThresholds('monthly', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => saveConfig('volume_thresholds', config.volume_thresholds?.value, config.volume_thresholds?.description)}
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Thresholds
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="motivations">
            <Card>
              <CardHeader>
                <CardTitle>Risk Motivations</CardTitle>
                <CardDescription>
                  Configure risk motivation names, weights, and thresholds
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {config.risk_motivations?.value && Object.entries(config.risk_motivations.value).map(([key, motivation]) => (
                  <Card key={key}>
                    <CardHeader>
                      <CardTitle className="text-lg capitalize">{key.replace(/_/g, ' ')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={motivation.name}
                          onChange={(e) => updateRiskMotivation(key, 'name', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Weight</Label>
                        <select
                          className="w-full p-2 border rounded-md"
                          value={motivation.weight}
                          onChange={(e) => updateRiskMotivation(key, 'weight', e.target.value)}
                        >
                          <option value="base">Base</option>
                          <option value="major">Major</option>
                          <option value="minor">Minor</option>
                        </select>
                      </div>
                      {'threshold_percentage' in motivation && (
                        <div className="space-y-2">
                          <Label>Threshold Percentage (%)</Label>
                          <Input
                            type="number"
                            value={motivation.threshold_percentage}
                            onChange={(e) => updateRiskMotivation(key, 'threshold_percentage', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={motivation.enabled}
                          onCheckedChange={(checked) => updateRiskMotivation(key, 'enabled', checked)}
                        />
                        <Label>Enabled</Label>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  onClick={() => saveConfig('risk_motivations', config.risk_motivations?.value, config.risk_motivations?.description)}
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Motivations
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="levels">
            <Card>
              <CardHeader>
                <CardTitle>Risk Levels & Escalation Rules</CardTitle>
                <CardDescription>
                  Configure base risk levels, escalation rules, and score mappings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-4">Base Levels</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {config.risk_levels?.value?.base_levels && Object.entries(config.risk_levels.value.base_levels).map(([key, value]) => (
                      <div key={key} className="space-y-2">
                        <Label className="capitalize">{key.replace(/_/g, ' ')}</Label>
                        <select
                          className="w-full p-2 border rounded-md"
                          value={value}
                          onChange={(e) => updateRiskLevels('base_levels', key, e.target.value)}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Elevato">Elevato</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-4">Score Mapping</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {config.risk_levels?.value?.score_mapping && Object.entries(config.risk_levels.value.score_mapping).map(([key, value]) => (
                      <div key={key} className="space-y-2">
                        <Label>{key}</Label>
                        <Input
                          type="number"
                          value={value}
                          onChange={(e) => updateRiskLevels('score_mapping', key, parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={() => saveConfig('risk_levels', config.risk_levels?.value, config.risk_levels?.description)}
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Risk Levels
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
