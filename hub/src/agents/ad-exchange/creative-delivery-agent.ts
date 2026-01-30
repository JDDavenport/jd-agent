import { adExchangeCreativeDeliveryService } from '../../services/ad-exchange-creative-delivery-service';

export class CreativeDeliveryAgent {
  validateCreativeAssets(urls?: string[], clickThroughUrl?: string) {
    return adExchangeCreativeDeliveryService.validateCreativeAssets(urls, clickThroughUrl);
  }

  recordImpression(adSpaceId: string, allocationId?: string) {
    return adExchangeCreativeDeliveryService.recordImpression(adSpaceId, allocationId);
  }

  recordClick(adSpaceId: string, allocationId?: string) {
    return adExchangeCreativeDeliveryService.recordClick(adSpaceId, allocationId);
  }

  rotateCreative(allocationId: string) {
    return adExchangeCreativeDeliveryService.rotateCreative(allocationId);
  }

  detectClickFraud(adSpaceId: string, threshold?: number) {
    return adExchangeCreativeDeliveryService.detectClickFraud(adSpaceId, threshold);
  }

  selectABVariant(variants: string[]) {
    return adExchangeCreativeDeliveryService.selectABVariant(variants);
  }
}
