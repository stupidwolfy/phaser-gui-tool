import { useSyncExternalStore } from 'react';

/**
 * Subscribes to a CSS media query.
 *
 * `useSyncExternalStore` rather than state + effect so the very first render
 * already knows whether we are on a phone — otherwise the desktop layout
 * flashes before the mobile one takes over.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false, // Server/prerender fallback: assume desktop.
  );
}

/** Single breakpoint for the whole app, so panels and sheets can never disagree. */
export const MOBILE_QUERY = '(max-width: 900px)';

export const useIsMobile = (): boolean => useMediaQuery(MOBILE_QUERY);
