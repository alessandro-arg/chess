import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Auth } from '@angular/fire/auth';
import { Database } from '@angular/fire/database';
import {
  ref as dbRef,
  onValue,
  onDisconnect,
  serverTimestamp,
  update,
} from 'firebase/database';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PresenceService {
  private readonly isBrowser: boolean;

  constructor(
    private readonly auth: Auth,
    private readonly db: Database,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.initMyPresence();
    }
  }

  private initMyPresence() {
    const infoRef = dbRef(this.db, '.info/connected');
    onValue(infoRef, async (snap) => {
      const connected = snap.val() === true;
      const uid = this.auth.currentUser?.uid;
      if (!uid) return;

      const statusRef = dbRef(this.db, `status/${uid}`);
      if (!connected) {
        await update(statusRef, {
          state: 'offline',
          last_changed: serverTimestamp(),
        });
        return;
      }
      try {
        await onDisconnect(statusRef).update({
          state: 'offline',
          last_changed: serverTimestamp(),
        });
      } catch {}
      await update(statusRef, {
        state: 'online',
        last_changed: serverTimestamp(),
      });
    });
  }

  presence$(uid: string): Observable<boolean> {
    return new Observable<boolean>((sub) => {
      if (!uid) {
        sub.next(false);
        sub.complete();
        return;
      }
      const statusRef = dbRef(this.db, `status/${uid}`);
      const off = onValue(statusRef, (snap) => {
        const v = snap.val();
        sub.next(v?.state === 'online');
      });
      return () => off();
    });
  }
}
