import { Injectable } from '@angular/core';
import { Firestore, doc, docData, setDoc } from '@angular/fire/firestore';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { AuthService } from './auth.service';
import { Observable, map } from 'rxjs';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(
    private readonly firestore: Firestore,
    private readonly auth: AuthService
  ) {}

  userProfile$(uid: string): Observable<UserProfile | null> {
    const ref = doc(this.firestore, 'users', uid);
    return docData(ref, { idField: 'uid' }).pipe(
      map((d: any) => (d as UserProfile) ?? null)
    );
  }

  upsertProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    const ref = doc(this.firestore, 'users', uid);
    return setDoc(ref, data, { merge: true });
  }

  async isDisplayNameTaken(
    displayName: string,
    excludeUid?: string
  ): Promise<boolean> {
    const col = collection(this.firestore as any, 'users');
    const q = query(col, where('displayName', '==', displayName), limit(5));
    const snap = await getDocs(q);
    if (snap.empty) return false;
    if (!excludeUid) return true;
    return snap.docs.some((d) => d.id !== excludeUid);
  }
}
