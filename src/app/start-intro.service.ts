import { Injectable } from '@angular/core';

const INTRO_KEY = 'introSeen_session_v1';

@Injectable({ providedIn: 'root' })
export class StartIntroService {
  hasSeen(): boolean {
    try {
      return sessionStorage.getItem(INTRO_KEY) === '1';
    } catch {
      return true;
    }
  }
  markSeen(): void {
    try {
      sessionStorage.setItem(INTRO_KEY, '1');
    } catch {}
  }
}
