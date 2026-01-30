/**
 * Ad Exchange Wallet Service
 *
 * Multi-signature enforcement hooks for large transfers.
 */

export type MultisigPaymentType =
  | 'ad_space_ownership'
  | 'allocation_acquisition'
  | 'ad_space_weekly_fee'
  | 'allocation_weekly_fee';

class AdExchangeWalletService {
  getMultisigAddress() {
    return process.env.AD_EXCHANGE_MULTISIG_ADDRESS;
  }

  getThreshold() {
    const threshold = Number(process.env.AD_EXCHANGE_MULTISIG_THRESHOLD || 0);
    return Number.isFinite(threshold) ? threshold : 0;
  }

  requiresMultisig(amount: number, paymentType: MultisigPaymentType) {
    const threshold = this.getThreshold();
    if (threshold <= 0) return false;
    const applies =
      paymentType === 'ad_space_ownership' || paymentType === 'allocation_acquisition';
    return applies && amount >= threshold;
  }

  validateMultisigTransaction(transactionHash?: string) {
    return typeof transactionHash === 'string' && transactionHash.length > 0;
  }
}

export const adExchangeWalletService = new AdExchangeWalletService();
