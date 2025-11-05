'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';
import type {
  CompetitionData,
  TraderInfo,
  SystemStatus,
  AccountInfo,
  Position,
  DecisionRecord,
  Statistics,
  EquityPoint,
  PerformanceAnalysis,
  MaskedSystemConfig,
} from '@/types';

// SWR configuration
const defaultConfig = {
  refreshInterval: 15000, // 15 seconds
  revalidateOnFocus: false,
  dedupingInterval: 10000,
};

/**
 * Fetch competition data (all traders comparison)
 */
export function useCompetition() {
  return useSWR<CompetitionData>(
    'competition',
    () => api.getCompetition(),
    {
      refreshInterval: 15000,
      revalidateOnFocus: false,
    }
  );
}

/**
 * Fetch all traders list
 */
export function useTraders() {
  return useSWR<TraderInfo[]>(
    'traders',
    () => api.getTraders(),
    {
      refreshInterval: 10000,
      revalidateOnFocus: false,
    }
  );
}

/**
 * Fetch system status for a specific trader
 */
export function useStatus(traderId?: string) {
  return useSWR<SystemStatus>(
    traderId ? `status-${traderId}` : null,
    () => api.getStatus(traderId),
    defaultConfig
  );
}

/**
 * Fetch account info for a specific trader
 */
export function useAccount(traderId?: string) {
  return useSWR<AccountInfo>(
    traderId ? `account-${traderId}` : null,
    () => api.getAccount(traderId),
    {
      ...defaultConfig,
      refreshInterval: 10000, // More frequent for account data
    }
  );
}

/**
 * Fetch positions for a specific trader
 */
export function usePositions(traderId?: string) {
  return useSWR<Position[]>(
    traderId ? `positions-${traderId}` : null,
    () => api.getPositions(traderId),
    defaultConfig
  );
}

/**
 * Fetch all decision records for a specific trader
 */
export function useDecisions(traderId?: string) {
  return useSWR<DecisionRecord[]>(
    traderId ? `decisions-${traderId}` : null,
    () => api.getDecisions(traderId),
    {
      refreshInterval: 30000, // Less frequent
      revalidateOnFocus: false,
    }
  );
}

/**
 * Fetch latest decision records for a specific trader
 */
export function useLatestDecisions(traderId?: string) {
  return useSWR<DecisionRecord[]>(
    traderId ? `decisions-latest-${traderId}` : null,
    () => api.getLatestDecisions(traderId),
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
    }
  );
}

/**
 * Fetch statistics for a specific trader
 */
export function useStatistics(traderId?: string) {
  return useSWR<Statistics>(
    traderId ? `statistics-${traderId}` : null,
    () => api.getStatistics(traderId),
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
    }
  );
}

/**
 * Fetch equity history for a specific trader
 */
export function useEquityHistory(traderId?: string) {
  return useSWR<EquityPoint[]>(
    traderId ? `equity-history-${traderId}` : null,
    () => api.getEquityHistory(traderId),
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
    }
  );
}

/**
 * Fetch performance analysis for a specific trader
 */
export function usePerformance(traderId?: string) {
  return useSWR<PerformanceAnalysis>(
    traderId ? `performance-${traderId}` : null,
    () => api.getPerformance(traderId),
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
    }
  );
}

/**
 * Fetch system configuration (masked sensitive keys)
 */
export function useConfig() {
  return useSWR<MaskedSystemConfig>(
    'config',
    () => api.getConfig(),
    {
      refreshInterval: 60000, // 1 minute (config rarely changes)
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );
}
