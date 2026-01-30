import { adExchangeMarketplaceService } from '../../services/ad-exchange-marketplace-service';

export class MarketplaceOperationsAgent {
  async createListing(input: Parameters<typeof adExchangeMarketplaceService.createListing>[0]) {
    return adExchangeMarketplaceService.createListing(input);
  }

  async purchaseListing(input: Parameters<typeof adExchangeMarketplaceService.purchaseListing>[0]) {
    return adExchangeMarketplaceService.purchaseListing(input);
  }
}
