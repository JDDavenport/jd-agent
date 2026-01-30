import { adExchangeAnalyticsService } from '../../services/ad-exchange-analytics-service';

export class AnalyticsInsightsAgent {
  async getSummary() {
    return adExchangeAnalyticsService.getSummary();
  }

  async getAdSpacePerformance(adSpaceId: string) {
    return adExchangeAnalyticsService.getAdSpacePerformance(adSpaceId);
  }

  async getAllocationPerformance(allocationId: string) {
    return adExchangeAnalyticsService.getAllocationPerformance(allocationId);
  }
}
