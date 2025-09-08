import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  docData,
  setDoc,
  serverTimestamp,
  collection,
  collectionGroup,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  updateDoc,
  deleteDoc,
  getDoc,
  addDoc,
  collectionData,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { map, Observable, of } from 'rxjs';
import { GameRtdbService } from './game-rtdb.service';
import { EloService } from './elo.service';

export interface GameInvite {
  id: string;
  fromUid: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  gameId?: string;
  createdAt: any;
  updatedAt: any;
  tc?: { minutes: number; increment: number };
  colorPref?: 'white' | 'black' | 'random';
}

export interface GameDoc {
  id: string;
  players: { white: string | null; black: string | null; both: string[] };
  status: 'waiting' | 'active' | 'finished';
  createdAt: any;
  updatedAt: any;
  finishedAt: any;

  mode?: 'pvp' | 'bot';
  bot?: { difficulty: 'easy' | 'medium' | 'hard' };
  tc?: { minutes: number; increment: number };
  result?: '1-0' | '0-1' | '1/2-1/2' | null;
}

export interface GameParticipant {
  uid: string;
  joinedAt: any;
  lastActiveAt: any;
}

export interface BotGameCreate {
  userUid: string;
  difficulty: 'easy' | 'medium' | 'hard';
  minutes: number;
  increment: number;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  constructor(private rtdbGame: GameRtdbService, private elo: EloService) {}

  invite$(inviteId: string): Observable<GameInvite | null> {
    const ref = doc(this.firestore, 'gameInvites', inviteId);
    return new Observable((sub) => {
      const unsub = onSnapshot(
        ref,
        (snap) => {
          sub.next(snap.exists() ? (snap.data() as GameInvite) : null);
        },
        (err) => sub.error(err)
      );
      return () => unsub();
    });
  }

  game$(gameId: string): Observable<GameDoc | null> {
    const ref = doc(this.firestore, 'games', gameId);
    return new Observable((sub) => {
      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) {
            sub.next(null);
            return;
          }
          const data = snap.data() as any;
          sub.next({ id: snap.id, ...data } as GameDoc);
        },
        (err) => sub.error(err)
      );
      return () => unsub();
    });
  }

  participants$(gameId: string): Observable<GameParticipant[]> {
    const colRef = collection(this.firestore, 'games', gameId, 'participants');
    return new Observable<GameParticipant[]>((sub) => {
      const unsub = onSnapshot(
        colRef,
        (snap) => {
          sub.next(snap.docs.map((d) => d.data() as GameParticipant));
        },
        (err) => sub.error(err)
      );
      return () => unsub();
    });
  }

  async joinGame(gameId: string, uid: string): Promise<void> {
    const ref = doc(this.firestore, 'games', gameId, 'participants', uid);
    await setDoc(
      ref,
      {
        uid,
        joinedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

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

  lastSeenGameInviteAt$() {
    return new Promise<import('rxjs').Observable<number | null>>((resolve) => {
      (async () => {
        const { authState } = await import('@angular/fire/auth');
        authState(this.auth).subscribe((user) => {
          if (!user) return;
          const ref = doc(this.firestore, 'users', user.uid);
          resolve(
            docData(ref).pipe(
              map(
                (u: any) =>
                  u?.notifications?.gameInviteLastSeenAt?.toMillis?.() ?? null
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

  async markAllNotificationsSeen(): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return;
    const ref = doc(this.firestore, 'users', uid);
    await setDoc(
      ref,
      {
        notifications: {
          friendReqLastSeenAt: serverTimestamp(),
          gameInviteLastSeenAt: serverTimestamp(),
        },
      },
      { merge: true }
    );
  }

  async sendGameInvite(toUid: string): Promise<void> {
    const fromUid = this.auth.currentUser?.uid;
    if (!fromUid || !toUid || fromUid === toUid) return;
    const id = `${fromUid}_${toUid}`;
    const ref = doc(this.firestore, 'gameInvites', id);

    await setDoc(
      ref,
      {
        id,
        fromUid,
        toUid,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  async sendFriendInvite(
    toUid: string,
    opts: {
      minutes: number;
      increment?: number;
      color: 'white' | 'black' | 'random';
    }
  ): Promise<void> {
    const fromUid = this.auth.currentUser?.uid;
    if (!fromUid || !toUid || fromUid === toUid) return;

    const id = `${fromUid}_${toUid}`;
    const ref = doc(this.firestore, 'gameInvites', id);

    await setDoc(
      ref,
      {
        id,
        fromUid,
        toUid,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        tc: { minutes: opts.minutes, increment: opts.increment ?? 0 },
        colorPref: opts.color,
      } as GameInvite,
      { merge: true }
    );
  }

  incomingGameInvites$(): Observable<GameInvite[]> {
    const user = this.auth.currentUser;
    if (!user) return of([]);
    const col = collection(this.firestore, 'gameInvites');
    const q = query(
      col,
      where('toUid', '==', user.uid),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    return new Observable<GameInvite[]>((sub) => {
      const unsub = onSnapshot(
        q,
        (snap) => {
          sub.next(snap.docs.map((d) => d.data() as GameInvite));
        },
        (err) => sub.error(err)
      );
      return () => unsub();
    });
  }

  outgoingGameInvites$(): Observable<GameInvite[]> {
    const user = this.auth.currentUser;
    if (!user) return of([]);
    const col = collection(this.firestore, 'gameInvites');
    const q = query(
      col,
      where('fromUid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    return new Observable<GameInvite[]>((sub) => {
      const unsub = onSnapshot(
        q,
        (snap) => {
          sub.next(snap.docs.map((d) => d.data() as GameInvite));
        },
        (err) => sub.error(err)
      );
      return () => unsub();
    });
  }

  async acceptInviteAndCreateGame(inviteId: string): Promise<string> {
    const ref = doc(this.firestore, 'gameInvites', inviteId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Invite not found');
    const inv = snap.data() as GameInvite;

    const me = this.auth.currentUser?.uid;
    if (!me || inv.toUid !== me) throw new Error('Not allowed');

    const minutes = inv.tc?.minutes ?? 15;
    const increment = inv.tc?.increment ?? 0;
    let white = inv.fromUid;
    let black = inv.toUid;

    switch (inv.colorPref) {
      case 'white':
        white = inv.fromUid;
        black = inv.toUid;
        break;
      case 'black':
        white = inv.toUid;
        black = inv.fromUid;
        break;
      case 'random':
        // deterministic-ish random using createdAt seconds fallback
        {
          const seed =
            (inv as any)?.createdAt?.seconds ?? Math.floor(Date.now() / 1000);
          const r = seed % 2;
          if (r === 0) {
            white = inv.fromUid;
            black = inv.toUid;
          } else {
            white = inv.toUid;
            black = inv.fromUid;
          }
        }
        break;
      default:
        // legacy behavior already set above
        break;
    }

    const gamesCol = collection(this.firestore, 'games');
    const gameRef = await addDoc(gamesCol, {
      players: { white, black, both: [inv.fromUid, inv.toUid] },
      mode: 'pvp',
      tc: { minutes, increment },
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await this.rtdbGame.create(gameRef.id, white, black, {
      minutes,
      increment,
    });

    await updateDoc(ref, {
      status: 'accepted',
      gameId: gameRef.id,
      updatedAt: serverTimestamp(),
    });

    return gameRef.id;
  }

  async cancelInvite(inviteId: string): Promise<void> {
    const ref = doc(this.firestore, 'gameInvites', inviteId);
    await updateDoc(ref, { status: 'cancelled', updatedAt: serverTimestamp() });
  }

  async declineInvite(inviteId: string): Promise<void> {
    const ref = doc(this.firestore, 'gameInvites', inviteId);
    await updateDoc(ref, { status: 'declined', updatedAt: serverTimestamp() });
  }

  async touchGame(gameId: string, uid: string): Promise<void> {
    const ref = doc(this.firestore, 'games', gameId, 'participants', uid);
    await setDoc(ref, { lastActiveAt: serverTimestamp() }, { merge: true });
  }

  async leaveGame(gameId: string, uid: string): Promise<void> {
    const ref = doc(this.firestore, 'games', gameId, 'participants', uid);
    await deleteDoc(ref);
  }

  async createBotGame(cfg: BotGameCreate): Promise<string> {
    const gamesCol = collection(this.firestore, 'games');
    const ref = await addDoc(gamesCol, {
      players: {
        white: cfg.userUid,
        black: 'Bot',
        both: [cfg.userUid, 'Bot'],
      },
      mode: 'bot',
      bot: { difficulty: cfg.difficulty },
      tc: { minutes: cfg.minutes, increment: cfg.increment },
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await this.rtdbGame.create(ref.id, cfg.userUid, 'Bot', {
      minutes: cfg.minutes,
      increment: cfg.increment,
    });

    return ref.id;
  }

  async updateGameResult(
    gameId: string,
    payload: {
      status: 'mate' | 'draw' | 'flag' | 'resign' | 'aborted' | 'finished';
      result: '1-0' | '0-1' | '1/2-1/2' | null;
    }
  ) {
    const ref = doc(this.firestore, 'games', gameId);
    await updateDoc(ref, {
      status: payload.status,
      result: payload.result,
      finishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    try {
      const snap = await getDoc(ref);
      const g = snap.data() as any;
      if (g?.mode === 'pvp' && g?.result) {
        // confirm -> vote -> finalize (idempotent)
        await this.elo.confirmResult(gameId);
        await this.elo.proposeVote(gameId);
        await this.elo.finalize(gameId);
      }
    } catch (e) {
      console.error(
        'Elo finalize failed (will retry when opponent opens modal):',
        e
      );
    }
  }

  async syncEloForFinishedGame(gameId: string): Promise<void> {
    try {
      await this.elo.confirmResult(gameId);
      await this.elo.proposeVote(gameId);
      await this.elo.finalize(gameId);
    } catch (e) {
      console.error('syncEloForFinishedGame:', e);
    }
  }

  /**
   * Stream games that include the given uid (players.both array-contains)
   * Sorted latest → oldest by updatedAt (fallback if you prefer finishedAt).
   * Firestore may prompt you for a composite index; follow the link it gives.
   */
  gamesForUser$(uid: string, max = 10): Observable<GameDoc[]> {
    const colRef = collection(this.firestore, 'games');
    const qy = query(
      colRef,
      where('players.both', 'array-contains', uid),
      // Use finishedAt if you prefer; see note below
      orderBy('updatedAt', 'desc'),
      limit(max)
    );

    return collectionData(qy, { idField: 'id' }).pipe(
      map((rows) => rows as GameDoc[])
    );
  }

  /**
   * Convenience stream for the *current* signed-in user.
   * If not signed in yet, emits [].
   */
  gamesForCurrentUser$(max = 10): Observable<GameDoc[]> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return of([]);
    return this.gamesForUser$(uid, max);
  }
}
