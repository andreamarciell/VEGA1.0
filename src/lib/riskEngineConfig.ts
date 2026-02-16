import { api } from '@/lib/apiClient';

export interface VolumeThresholds {
  daily: number;
  weekly: number;
  monthly: number;
}

export interface RiskMotivation {
  name: string;
  weight: 'base' | 'major' | 'minor';
  threshold_percentage?: number;
  enabled: boolean;
}

export interface RiskMotivations {
  frazionate: RiskMotivation;
  bonus_concentration: RiskMotivation;
  casino_live: RiskMotivation;
  volumes_daily: RiskMotivation;
  volumes_weekly: RiskMotivation;
  volumes_monthly: RiskMotivation;
}

export interface RiskLevels {
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
}

export interface RiskEngineConfig {
  volumeThresholds: VolumeThresholds;
  riskMotivations: RiskMotivations;
  riskLevels: RiskLevels;
}

let cachedConfig: RiskEngineConfig | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getRiskEngineConfig(): Promise<RiskEngineConfig> {
  // Check cache
  const now = Date.now();
  if (cachedConfig && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedConfig;
  }

  try {
    const response = await api.get('/api/v1/players/risk-config');
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.config) {
      const result: RiskEngineConfig = {
        volumeThresholds: data.config.volumeThresholds || getDefaultConfig().volumeThresholds,
        riskMotivations: data.config.riskMotivations || getDefaultConfig().riskMotivations,
        riskLevels: data.config.riskLevels || getDefaultConfig().riskLevels,
      };

      cachedConfig = result;
      cacheTimestamp = now;
      return result;
    } else {
      throw new Error('Invalid response format from API');
    }
  } catch (error) {
    console.error('Error fetching risk engine config:', error);
    // Fallback ai valori di default per evitare schermata bianca
    const defaultConfig = getDefaultConfig();
    cachedConfig = defaultConfig;
    cacheTimestamp = now;
    return defaultConfig;
  }
}

export function getDefaultConfig(): RiskEngineConfig {
  return {
    volumeThresholds: {
      daily: 5000,
      weekly: 10000,
      monthly: 15000,
    },
    riskMotivations: {
      frazionate: {
        name: "Rilevato structuring tramite operazioni frazionate.",
        weight: "major",
        enabled: true,
      },
      bonus_concentration: {
        name: "Rilevata concentrazione di bonus.",
        weight: "major",
        threshold_percentage: 10,
        enabled: true,
      },
      casino_live: {
        name: "Rilevata attività significativa su casino live.",
        weight: "minor",
        threshold_percentage: 40,
        enabled: true,
      },
      volumes_daily: {
        name: "Rilevati volumi significativamente elevati su base giornaliera",
        weight: "base",
        enabled: true,
      },
      volumes_weekly: {
        name: "Rilevati volumi significativamente elevati su base settimanale",
        weight: "base",
        enabled: true,
      },
      volumes_monthly: {
        name: "Rilevati volumi significativamente elevati su base mensile",
        weight: "base",
        enabled: true,
      },
    },
    riskLevels: {
      base_levels: {
        monthly_exceeded: "High",
        weekly_or_daily_exceeded: "Medium",
        default: "Low",
      },
      escalation_rules: {
        Low: {
          major_aggravants: "High",
          minor_aggravants: "Medium",
        },
        Medium: {
          major_aggravants: "High",
        },
        High: {
          any_aggravants: "Elevato",
        },
      },
      score_mapping: {
        Elevato: 100,
        High: 80,
        Medium: 50,
        Low: 20,
      },
    },
  };
}

export function clearConfigCache() {
  cachedConfig = null;
  cacheTimestamp = 0;
}
