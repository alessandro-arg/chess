import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  docData,
  setDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { map, of, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  lastSeenFriendReqAt$() {
    return new Promise<import('rxjs').Observable<number | null>>((resolve) => {
      const sub = (async () => {
        const { authState } = await import('@angular/fire/auth');
        authState(this.auth).subscribe((user) => {
          if (!user) return;
          const ref = doc(this.firestore, 'users', user.uid);
          resolve(
            docData(ref).pipe(
              map(
                (u: any) =>
                  u?.notifications?.friendReqLastSeenAt?.toMillis?.() ?? null
              )
            )
          );
        });
      })();
    });
  }

  async markFriendRequestsSeen(): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return;
    const ref = doc(this.firestore, 'users', uid);
    await setDoc(
      ref,
      {
        notifications: { friendReqLastSeenAt: serverTimestamp() },
      },
      { merge: true }
    );
  }
}
