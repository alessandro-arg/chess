import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  collection,
} from '@angular/fire/firestore';
import { applyElo, expectedScore, kFactor, Outcome, TcKey } from './shared/elo';

@Injectable({ providedIn: 'root' })
export class EloService {
  private db = inject(Firestore);
  private auth = inject(Auth);

  private resultToOutcome(result: '1-0' | '0-1' | '1/2-1/2'): Outcome {
    return result === '1-0' ? 'white' : result === '0-1' ? 'black' : 'draw';
  }

  async confirmResult(gameId: string): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return;
    const gref = doc(this.db, 'games', gameId);
    const gsnap = await getDoc(gref);
    if (!gsnap.exists()) throw new Error('Game not found');

    await updateDoc(gref, {
      [`confirm.${uid}`]: true,
      updatedAt: serverTimestamp(),
    });
  }

  /** Each player writes their own vote doc with computed numbers. */
  async proposeVote(gameId: string): Promise<void> {
    const me = this.auth.currentUser?.uid;
    if (!me) throw new Error('Not signed in');

    const gref = doc(this.db, 'games', gameId);
    const gsnap = await getDoc(gref);
    if (!gsnap.exists()) throw new Error('Game not found');
    const game: any = gsnap.data();

    if (game.mode !== 'pvp' || !game.result) throw new Error('Game not final');

    const tc: TcKey = String(game?.tc?.minutes) as TcKey;
    if (!['5', '10', '20'].includes(tc as any))
      throw new Error('Unrated time control');

    const whiteUid = game.players?.white;
    const blackUid = game.players?.black;
    if (!whiteUid || !blackUid) throw new Error('Missing players');

    const mySide = me === whiteUid ? 'white' : me === blackUid ? 'black' : null;
    if (!mySide) throw new Error('Not a participant');

    const wref = doc(this.db, 'users', whiteUid);
    const bref = doc(this.db, 'users', blackUid);
    const [wsnap, bsnap] = await Promise.all([getDoc(wref), getDoc(bref)]);
    const w = (wsnap.data() as any)?.elo?.[tc] ?? { rating: 400, games: 0 };
    const b = (bsnap.data() as any)?.elo?.[tc] ?? { rating: 400, games: 0 };

    const outcome = this.resultToOutcome(game.result as any);
    const kw = kFactor(w.games, w.rating);
    const kb = kFactor(b.games, b.rating);
    const {
      newA: wNew,
      newB: bNew,
      Ea,
      Eb,
      deltaA,
      deltaB,
    } = applyElo(w.rating, b.rating, outcome, kw, kb);

    const myVote =
      mySide === 'white'
        ? {
            before: w.rating,
            after: wNew,
            delta: deltaA,
            expected: Ea,
            k: kw,
            side: 'white',
            oppUid: blackUid,
          }
        : {
            before: b.rating,
            after: bNew,
            delta: deltaB,
            expected: Eb,
            k: kb,
            side: 'black',
            oppUid: whiteUid,
          };

    const vref = doc(collection(this.db, 'games', gameId, 'eloVotes'), me);
    await setDoc(
      vref,
      { uid: me, tc, result: game.result, ...myVote, at: serverTimestamp() },
      { merge: true }
    );
  }

  /** Try to finalize Elo for a game; safe & idempotent. */
  async finalize(gameId: string): Promise<boolean> {
    const me = this.auth.currentUser?.uid;
    if (!me) throw new Error('Not signed in');

    const ok = await runTransaction(this.db, async (tx) => {
      const gref = doc(this.db, 'games', gameId);
      const gsnap = await tx.get(gref);
      if (!gsnap.exists()) throw new Error('Game not found');
      const game: any = gsnap.data();

      if (game.mode !== 'pvp' || !game.result || game.eloComputed === true)
        return false;

      const tc: TcKey = String(game?.tc?.minutes) as TcKey;
      if (!['5', '10', '20'].includes(tc as any)) return false;

      const whiteUid = game.players?.white;
      const blackUid = game.players?.black;
      if (!whiteUid || !blackUid) return false;

      // both votes present?
      const wVoteRef = doc(this.db, 'games', gameId, 'eloVotes', whiteUid);
      const bVoteRef = doc(this.db, 'games', gameId, 'eloVotes', blackUid);
      const [wVoteSnap, bVoteSnap] = await Promise.all([
        tx.get(wVoteRef),
        tx.get(bVoteRef),
      ]);
      if (!wVoteSnap.exists() || !bVoteSnap.exists()) return false;

      const wv: any = wVoteSnap.data();
      const bv: any = bVoteSnap.data();
      if (
        wv.tc !== tc ||
        bv.tc !== tc ||
        wv.result !== game.result ||
        bv.result !== game.result
      )
        return false;

      // floor sanity (since clamping can break zero-sum deltas)
      if (wv.after < 350 || bv.after < 350) return false;

      // read current user docs
      const wref = doc(this.db, 'users', whiteUid);
      const bref = doc(this.db, 'users', blackUid);
      const [wsnap, bsnap] = await Promise.all([tx.get(wref), tx.get(bref)]);
      const w = (wsnap.data() as any)?.elo?.[tc] ?? { rating: 400, games: 0 };
      const b = (bsnap.data() as any)?.elo?.[tc] ?? { rating: 400, games: 0 };

      // votes must match "before" values to avoid races
      if (Math.abs(w.rating - wv.before) > 0.01) return false;
      if (Math.abs(b.rating - bv.before) > 0.01) return false;

      // apply
      const wNew = { rating: wv.after, games: (w.games ?? 0) + 1 };
      const bNew = { rating: bv.after, games: (b.games ?? 0) + 1 };

      tx.update(wref, { [`elo.${tc}`]: wNew, eloLastGameId: gameId });
      tx.update(bref, { [`elo.${tc}`]: bNew, eloLastGameId: gameId });

      tx.update(gref, {
        eloComputed: true,
        ratingsBefore: { white: w.rating, black: b.rating },
        ratingsAfter: { white: wNew.rating, black: bNew.rating },
        eloAppliedAt: serverTimestamp(),
      });

      return true;
    });

    return ok;
  }
}
