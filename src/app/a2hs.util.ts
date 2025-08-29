const A2HS_SHOWN_KEY = 'a2hsShown@v1'; // bump to @v2 if you ever want to show it again after a big update

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
export function isStandalone() {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}
export function eligibleForA2HS() {
  return isIos() && !isStandalone();
}

export function hasSeenA2HS(): boolean {
  try {
    return localStorage.getItem(A2HS_SHOWN_KEY) === '1';
  } catch {
    return false;
  }
}
export function markA2HSSeen(): void {
  try {
    localStorage.setItem(A2HS_SHOWN_KEY, '1');
  } catch {}
}
