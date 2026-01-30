import { useEffect, useMemo, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export function PwaUpdateToast() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updateServiceWorker, setUpdateServiceWorker] = useState<(() => void) | null>(null);

  useEffect(() => {
    const update = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onOfflineReady() {
        setOfflineReady(true);
        setTimeout(() => setOfflineReady(false), 4000);
      },
    });
    setUpdateServiceWorker(() => update);
  }, []);

  const visible = useMemo(
    () => !dismissed && (needRefresh || offlineReady),
    [dismissed, needRefresh, offlineReady]
  );

  if (!visible) return null;

  return (
    <div className="fixed left-3 right-3 bottom-24 z-50">
      <div className="bg-gray-900 text-white rounded-xl px-4 py-3 shadow-lg flex items-center gap-3">
        <div className="text-sm flex-1">
          {needRefresh ? 'Update available. Refresh to get the latest Vault changes.' : 'Vault is ready for offline use.'}
        </div>
        {needRefresh ? (
          <button
            onClick={() => updateServiceWorker?.()}
            className="px-3 py-1.5 bg-white/10 rounded-lg text-sm font-medium active:bg-white/20"
          >
            Refresh
          </button>
        ) : (
          <button
            onClick={() => setDismissed(true)}
            className="px-3 py-1.5 bg-white/10 rounded-lg text-sm font-medium active:bg-white/20"
          >
            OK
          </button>
        )}
      </div>
    </div>
  );
}
