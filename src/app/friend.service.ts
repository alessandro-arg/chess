import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  query,
  where,
  setDoc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, map, of, combineLatest } from 'rxjs';
import { getDocs, limit } from 'firebase/firestore';

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface Friendship {
  id: string;
  uids: [string, string];
  status: FriendshipStatus;
  requestedBy: string;
  updatedAt?: any;
}

@Injectable({
  providedIn: 'root',
})
export class FriendService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  private get currentUid(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    return uid;
  }

  private friendshipId(a: string, b: string): string {
    return [a, b].sort().join('_');
  }

  friendship$(otherUid: string): Observable<Friendship | null> {
    const id = this.friendshipId(this.currentUid, otherUid);
    const ref = doc(this.firestore, 'friendships', id);
    return docData(ref, { idField: 'id' }).pipe(
      map((d: any) => (d as Friendship) ?? null)
    );
  }

  myFriends$(): Observable<Friendship[]> {
    const col = collection(this.firestore, 'friendships');
    const qy = query(
      col,
      where('uids', 'array-contains', this.currentUid),
      where('status', '==', 'accepted')
    );
    return collectionData(qy, { idField: 'id' }) as Observable<Friendship[]>;
  }

  incomingPending$(): Observable<Friendship[]> {
    const col = collection(this.firestore, 'friendships');
    const qy = query(
      col,
      where('uids', 'array-contains', this.currentUid),
      where('status', '==', 'pending')
    );
    return collectionData(qy, { idField: 'id' }).pipe(
      map((rows: any[]) =>
        rows.filter((r) => r.requestedBy !== this.currentUid)
      )
    ) as Observable<Friendship[]>;
  }

  outgoingPending$(): Observable<Friendship[]> {
    const col = collection(this.firestore, 'friendships');
    const qy = query(
      col,
      where('uids', 'array-contains', this.currentUid),
      where('status', '==', 'pending')
    );
    return collectionData(qy, { idField: 'id' }).pipe(
      map((rows: any[]) =>
        rows.filter((r) => r.requestedBy === this.currentUid)
      )
    ) as Observable<Friendship[]>;
  }

  async sendRequest(otherUid: string): Promise<void> {
    const me = this.currentUid;
    if (otherUid === me) throw new Error('Cannot add yourself');

    const id = this.friendshipId(me, otherUid);
    const ref = doc(this.firestore, 'friendships', id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as Friendship;
      if (data.status === 'accepted') throw new Error('Already friends');
      if (data.status === 'pending') throw new Error('Request already pending');
      await updateDoc(ref, {
        status: 'pending',
        requestedBy: me,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    await setDoc(ref, {
      uids: [me, otherUid].sort(),
      requestedBy: me,
      status: 'pending',
      updatedAt: serverTimestamp(),
    } as Omit<Friendship, 'id'>);
  }

  async accept(otherUid: string): Promise<void> {
    const me = this.currentUid;
    const id = this.friendshipId(me, otherUid);
    const ref = doc(this.firestore, 'friendships', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('No request found');
    const data = snap.data() as Friendship;
    if (data.status !== 'pending') return;
    if (data.requestedBy === me) throw new Error('Requester cannot accept');
    await updateDoc(ref, { status: 'accepted', updatedAt: serverTimestamp() });
  }

  async decline(otherUid: string): Promise<void> {
    const me = this.currentUid;
    const id = this.friendshipId(me, otherUid);
    const ref = doc(this.firestore, 'friendships', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data() as Friendship;
    if (data.status !== 'pending') return;
    await updateDoc(ref, { status: 'declined', updatedAt: serverTimestamp() });
  }

  async searchUsers(term: string, excludeUids: string[] = []) {
    if (!term.trim()) return [];
    const lower = term.toLowerCase();

    const col = collection(this.firestore, 'users');
    const qy = query(
      col,
      where('searchKeywords', 'array-contains', lower),
      limit(3)
    );
    const snap = await getDocs(qy);

    const me = this.auth.currentUser?.uid ?? '';
    const block = new Set([me, ...excludeUids]);

    return snap.docs
      .map((d) => ({ uid: d.id, ...(d.data() as any) }))
      .filter((u) => !block.has(u.uid));
  }
}
