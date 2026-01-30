import apiClient from './client';
import type {
  CryptoAlert,
  CryptoCoin,
  CryptoFilters,
  CryptoHealthSummary,
  CryptoMarketPoint,
  CryptoNetworkPoint,
  CryptoPool,
} from '../types/crypto';

export async function getCoins(filters?: CryptoFilters): Promise<CryptoCoin[]> {
  return apiClient.get('/crypto/coins', { params: filters });
}

export async function getCoin(id: string): Promise<CryptoCoin> {
  return apiClient.get(`/crypto/coins/${id}`);
}

export async function getMarketHistory(
  id: string,
  range: '30d' | '90d' | '1y' | 'all' = '30d'
): Promise<CryptoMarketPoint[]> {
  return apiClient.get(`/crypto/coins/${id}/market`, { params: { range } });
}

export async function getNetworkHistory(
  id: string,
  range: '30d' | '90d' | '1y' | 'all' = '30d'
): Promise<CryptoNetworkPoint[]> {
  return apiClient.get(`/crypto/coins/${id}/network`, { params: { range } });
}

export async function getPools(id: string): Promise<CryptoPool[]> {
  return apiClient.get(`/crypto/coins/${id}/pools`);
}

export async function getCryptoAlerts(): Promise<CryptoAlert[]> {
  return apiClient.get('/crypto/alerts');
}

export async function getCryptoHealth(): Promise<CryptoHealthSummary> {
  return apiClient.get('/crypto/health');
}

export async function refreshCryptoMarketData(): Promise<{ message: string }> {
  return apiClient.post('/crypto/refresh');
}
