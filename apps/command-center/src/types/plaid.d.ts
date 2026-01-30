interface PlaidLinkOnSuccessMetadata {
  institution?: {
    name: string;
    institution_id: string;
  };
  accounts?: Array<{
    id: string;
    name: string;
    mask: string | null;
    type: string;
    subtype: string | null;
  }>;
}

interface PlaidLinkOnExitMetadata {
  status?: string;
  request_id?: string;
}

interface PlaidLinkOnEventMetadata {
  [key: string]: unknown;
}

interface PlaidLinkOptions {
  token: string;
  onSuccess: (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => void | Promise<void>;
  onExit?: (error: unknown, metadata: PlaidLinkOnExitMetadata) => void;
  onEvent?: (eventName: string, metadata: PlaidLinkOnEventMetadata) => void;
}

interface PlaidLinkHandler {
  open: () => void;
  exit: () => void;
}

interface Plaid {
  create: (options: PlaidLinkOptions) => PlaidLinkHandler;
}

interface Window {
  Plaid?: Plaid;
}
