export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
export function isStandalone() {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}
export function shouldShowA2HS() {
  return isIos() && !isStandalone();
}
