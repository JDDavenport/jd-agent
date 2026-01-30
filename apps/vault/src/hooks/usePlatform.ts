import { useState, useEffect } from 'react';

export type Platform = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'web';

interface PlatformInfo {
  platform: Platform;
  isTauri: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  isWeb: boolean;
}

// Check if running in Tauri
function detectTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

// Detect platform
function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'web';

  const userAgent = navigator.userAgent.toLowerCase();

  if (detectTauri()) {
    // In Tauri, check for mobile
    if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
    if (/android/.test(userAgent)) return 'android';
    if (/macintosh|mac os x/.test(userAgent)) return 'macos';
    if (/windows/.test(userAgent)) return 'windows';
    if (/linux/.test(userAgent)) return 'linux';
  }

  // In browser
  if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
  if (/android/.test(userAgent)) return 'android';

  return 'web';
}

export function usePlatform(): PlatformInfo {
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>(() => {
    const platform = detectPlatform();
    const isTauri = detectTauri();

    return {
      platform,
      isTauri,
      isMobile: platform === 'ios' || platform === 'android',
      isDesktop: platform === 'macos' || platform === 'windows' || platform === 'linux',
      isWeb: !isTauri,
    };
  });

  useEffect(() => {
    // Re-detect on mount (in case SSR detection was wrong)
    const platform = detectPlatform();
    const isTauri = detectTauri();

    setPlatformInfo({
      platform,
      isTauri,
      isMobile: platform === 'ios' || platform === 'android',
      isDesktop: platform === 'macos' || platform === 'windows' || platform === 'linux',
      isWeb: !isTauri,
    });
  }, []);

  return platformInfo;
}

// Static check for non-hook contexts
export function isTauriApp(): boolean {
  return detectTauri();
}

export function getCurrentPlatform(): Platform {
  return detectPlatform();
}
