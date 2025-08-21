import { Injectable } from '@angular/core';
import { Firestore, doc, docData, setDoc } from '@angular/fire/firestore';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { Observable, map } from 'rxjs';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private readonly firestore: Firestore) {}

  userProfile$(uid: string): Observable<UserProfile | null> {
    const ref = doc(this.firestore, 'users', uid);
    return docData(ref, { idField: 'uid' }).pipe(
      map((d: any) => (d as UserProfile) ?? null)
    );
  }

  upsertProfile(
    uid: string,
    data: Partial<UserProfile & { searchKeywords: string[] }>
  ): Promise<void> {
    const ref = doc(this.firestore, 'users', uid);
    const baseName = (data.displayName || '').toLowerCase();
    const email = (data.email || '').toLowerCase();
    const emailLocal = email.split('@')[0] || '';

    const tokens = new Set<string>();

    function addPrefixesAndTrigrams(s: string) {
      const cleaned = s.replace(/\s+/g, ' ').trim();
      if (!cleaned) return;

      const parts = cleaned.split(/[\s._-]+/).filter(Boolean);
      for (const part of parts) {
        for (let i = 1; i <= Math.min(part.length, 30); i++) {
          tokens.add(part.slice(0, i));
        }
      }
      const s2 = cleaned.replace(/\s+/g, '');
      for (let i = 0; i <= s2.length - 3; i++) {
        for (let L = 3; L <= Math.min(20, s2.length - i); L++) {
          tokens.add(s2.slice(i, i + L));
        }
      }
    }

    addPrefixesAndTrigrams(baseName);
    addPrefixesAndTrigrams(emailLocal);

    const searchKeywords = Array.from(tokens).slice(0, 200);

    return setDoc(ref, { ...data, searchKeywords }, { merge: true });
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
