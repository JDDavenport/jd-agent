import { adExchangeMarketIntelligenceService } from '../../services/ad-exchange-market-intelligence-service';

export class MarketIntelligenceAgent {
  async runSnapshot() {
    return adExchangeMarketIntelligenceService.getSnapshot();
  }

  async detectAnomalies() {
    return adExchangeMarketIntelligenceService.detectAnomalies();
  }

  async computeValuations() {
    return adExchangeMarketIntelligenceService.estimateValuations();
  }
}
