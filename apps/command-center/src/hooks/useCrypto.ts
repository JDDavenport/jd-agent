import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCoins,
  getCoin,
  getCryptoAlerts,
  getCryptoHealth,
  getMarketHistory,
  getNetworkHistory,
  getPools,
  refreshCryptoMarketData,
} from '../api/crypto';
import type {
  CryptoAlert,
  CryptoCoin,
  CryptoFilters,
  CryptoHealthSummary,
  CryptoMarketPoint,
  CryptoNetworkPoint,
  CryptoPool,
} from '../types/crypto';

export const cryptoKeys = {
  all: ['crypto'] as const,
  coins: () => [...cryptoKeys.all, 'coins'] as const,
  coinsList: (filters?: CryptoFilters) => [...cryptoKeys.coins(), 'list', filters] as const,
  coin: (id?: string) => [...cryptoKeys.coins(), 'detail', id] as const,
  market: (id?: string, range?: string) => [...cryptoKeys.all, 'market', id, range] as const,
  network: (id?: string, range?: string) => [...cryptoKeys.all, 'network', id, range] as const,
  pools: (id?: string) => [...cryptoKeys.all, 'pools', id] as const,
  alerts: () => [...cryptoKeys.all, 'alerts'] as const,
  health: () => [...cryptoKeys.all, 'health'] as const,
};

export function useCryptoCoins(filters?: CryptoFilters) {
  return useQuery<CryptoCoin[]>({
    queryKey: cryptoKeys.coinsList(filters),
    queryFn: () => getCoins(filters),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useCryptoCoin(id?: string) {
  return useQuery<CryptoCoin>({
    queryKey: cryptoKeys.coin(id),
    queryFn: () => getCoin(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useCryptoMarketHistory(id?: string, range: '30d' | '90d' | '1y' | 'all' = '30d') {
  return useQuery<CryptoMarketPoint[]>({
    queryKey: cryptoKeys.market(id, range),
    queryFn: () => getMarketHistory(id!, range),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useCryptoNetworkHistory(
  id?: string,
  range: '30d' | '90d' | '1y' | 'all' = '30d'
) {
  return useQuery<CryptoNetworkPoint[]>({
    queryKey: cryptoKeys.network(id, range),
    queryFn: () => getNetworkHistory(id!, range),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCryptoPools(id?: string) {
  return useQuery<CryptoPool[]>({
    queryKey: cryptoKeys.pools(id),
    queryFn: () => getPools(id!),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCryptoAlerts() {
  return useQuery<CryptoAlert[]>({
    queryKey: cryptoKeys.alerts(),
    queryFn: getCryptoAlerts,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useCryptoHealth() {
  return useQuery<CryptoHealthSummary>({
    queryKey: cryptoKeys.health(),
    queryFn: getCryptoHealth,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useRefreshCrypto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: refreshCryptoMarketData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cryptoKeys.coins() });
      queryClient.invalidateQueries({ queryKey: cryptoKeys.health() });
      queryClient.invalidateQueries({ queryKey: cryptoKeys.alerts() });
    },
  });
}
