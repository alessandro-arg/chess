import { Injectable, inject } from '@angular/core';
import {
  Database,
  ref,
  onValue,
  set,
  update,
  serverTimestamp as rtdbServerTs,
  runTransaction,
  push,
  onDisconnect,
  get,
  child,
} from '@angular/fire/database';
import { Auth } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { Chess } from 'chess.js';

type Turn = 'w' | 'b';

@Injectable({
  providedIn: 'root',
})
export class GameRtdbService {
  private db = inject(Database);
  private auth = inject(Auth);

  constructor() {}

  async create(
    gameId: string,
    whiteUid: string,
    blackUid: string,
    tc: { minutes: number; increment: number }
  ) {
    const chess = new Chess();
    const base = ref(this.db, `rt-games/${gameId}`);
    const total = tc.minutes * 60 * 1000;
    await set(base, {
      fen: chess.fen(),
      turn: 'w',
      status: 'active',
      result: null,
      players: { whiteUid, blackUid },
      lastMoveAt: Date.now(),
      remainingMs: { w: total, b: total },
      drawOffer: null,
      moveNumber: 1,
    });
  }

  game$(gameId: string): Observable<any> {
    return new Observable((sub) => {
      const r = ref(this.db, `rt-games/${gameId}`);
      const off = onValue(
        r,
        (snap) => sub.next(snap.val()),
        (err) => sub.error(err)
      );
      return () => off();
    });
  }

  async join(gameId: string, uid: string) {
    const p = ref(this.db, `rt-games/${gameId}/presence/${uid}`);
    await set(p, true);
    onDisconnect(p).remove();
  }

  serverOffset$(): Observable<number> {
    return new Observable((sub) => {
      const r = ref(this.db, '.info/serverTimeOffset');
      const off = onValue(r, (snap) => sub.next((snap.val() as number) ?? 0));
      return () => off();
    });
  }

  async tryMove(
    gameId: string,
    move: { from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' }
  ) {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');

    const base = ref(this.db, `rt-games/${gameId}`);

    await runTransaction(
      base,
      (g: any) => {
        if (!g || g.status !== 'active') return g;

        const isWhite = g.players?.whiteUid === uid;
        const myTurn: Turn = isWhite ? 'w' : 'b';
        if (g.turn !== myTurn) return g; // not your turn

        // time check: compute latest remaining for active side
        const now = Date.now();
        const elapsed = Math.max(0, now - (g.lastMoveAt || now));
        const remW = g.remainingMs?.w ?? 0;
        const remB = g.remainingMs?.b ?? 0;
        const remActive = g.turn === 'w' ? remW : remB;
        const after = remActive - elapsed;
        if (after <= 0) {
          // flag fall
          g.status = 'flag';
          g.result = g.turn === 'w' ? '0-1' : '1-0';
          return g;
        }

        // validate move using chess.js from current FEN
        const chess = new Chess(g.fen);
        const m = chess.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion || 'q',
        });
        if (!m) return g; // illegal

        const newFen = chess.fen();

        // apply increment to the mover, then switch turn and set lastMoveAt
        const incMs = 0; // tc.increment * 1000 — store increment on node if you want
        if (g.turn === 'w') {
          g.remainingMs.w = after + incMs;
        } else {
          g.remainingMs.b = after + incMs;
        }
        g.fen = newFen;
        g.turn = g.turn === 'w' ? 'b' : 'w';
        g.lastMoveAt = now;
        g.moveNumber = chess.moveNumber();

        // clear draw offer if any, and set status/result if game ended
        g.drawOffer = null;
        if (chess.isGameOver()) {
          if (chess.isCheckmate()) {
            g.status = 'mate';
            g.result = g.turn === 'w' ? '1-0' : '0-1'; // note: turn already flipped
          } else if (
            chess.isStalemate() ||
            chess.isDraw() ||
            chess.isInsufficientMaterial() ||
            chess.isThreefoldRepetition()
          ) {
            g.status = 'draw';
            g.result = '1/2-1/2';
          }
        }

        // append move
        const moves = g.moves || {};
        const id = push(child(base, 'moves')).key!;
        moves[id] = { san: m.san, by: uid, at: now, fenAfter: newFen };
        g.moves = moves;

        return g;
      },
      { applyLocally: false /* keeps UI consistent across clients */ }
    );
  }

  async offerDraw(gameId: string) {
    const uid = this.auth.currentUser?.uid;
    const base = ref(this.db, `rt-games/${gameId}`);
    await runTransaction(base, (g: any) => {
      if (!g || g.status !== 'active') return g;
      const meWhite = g.players?.whiteUid === uid;
      g.drawOffer = meWhite ? 'w' : 'b';
      return g;
    });
  }

  async acceptDraw(gameId: string) {
    const base = ref(this.db, `rt-games/${gameId}`);
    await runTransaction(base, (g: any) => {
      if (!g || g.status !== 'active' || !g.drawOffer) return g;
      g.status = 'draw';
      g.result = '1/2-1/2';
      g.drawOffer = null;
      return g;
    });
  }

  async resign(gameId: string) {
    const uid = this.auth.currentUser?.uid;
    const base = ref(this.db, `rt-games/${gameId}`);
    await runTransaction(base, (g: any) => {
      if (!g || g.status !== 'active') return g;
      const meWhite = g.players?.whiteUid === uid;
      g.status = 'resign';
      g.result = meWhite ? '0-1' : '1-0';
      return g;
    });
  }
}
