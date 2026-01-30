import { adExchangeEnforcementService } from '../../services/ad-exchange-enforcement-service';

export class ContractEnforcementAgent {
  async runWeeklyCycle() {
    return adExchangeEnforcementService.runWeeklyEnforcement();
  }
}
