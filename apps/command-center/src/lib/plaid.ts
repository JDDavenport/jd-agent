let plaidLoadPromise: Promise<typeof window.Plaid> | null = null;

export function loadPlaid(): Promise<typeof window.Plaid> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Plaid Link is only available in the browser'));
  }

  if (window.Plaid) {
    return Promise.resolve(window.Plaid);
  }

  if (!plaidLoadPromise) {
    plaidLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
      script.async = true;
      script.onload = () => {
        if (window.Plaid) {
          resolve(window.Plaid);
        } else {
          reject(new Error('Plaid Link failed to initialize'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load Plaid Link script'));
      document.body.appendChild(script);
    });
  }

  return plaidLoadPromise;
}
