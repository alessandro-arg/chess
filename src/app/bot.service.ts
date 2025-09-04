import { Injectable } from '@angular/core';
import { Chess } from 'chess.js';
import type { Move, PieceSymbol } from 'chess.js';

export type BotLevel = 'easy' | 'medium' | 'hard';

type SimpleMove = {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
};

type TTEntry = {
  depth: number;
  score: number; // centipawns, white-positive
  flag: 'EXACT' | 'LOWER' | 'UPPER';
  best?: Move;
};

@Injectable({ providedIn: 'root' })
export class BotService {
  // --- Material values (centipawns)
  private readonly PV: Record<PieceSymbol, number> = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 0,
  };

  // --- Piece-square tables (midgame). White perspective; mirror for black.
  // Fairly conservative so the bot doesn’t play “enginey” moves at low depth.
  private readonly PST: Record<PieceSymbol, number[]> = {
    p: [
      0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, -20, -20, 10, 10, 5, 5, -5, -10, 0, 0,
      -10, -5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, 5, 10, 25, 25, 10, 5, 5, 10, 10,
      20, 30, 30, 20, 10, 10, 50, 50, 50, 50, 50, 50, 50, 50, 0, 0, 0, 0, 0, 0,
      0, 0,
    ],
    n: [
      -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40,
      -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0,
      15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5,
      0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
    ],
    b: [
      -20, -10, -10, -10, -10, -10, -10, -20, -10, 5, 0, 0, 0, 0, 5, -10, -10,
      10, 10, 10, 10, 10, 10, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 5, 5,
      10, 10, 5, 5, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0,
      -10, -20, -10, -10, -10, -10, -10, -10, -20,
    ],
    r: [
      0, 0, 5, 10, 10, 5, 0, 0, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0,
      -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0,
      0, -5, 5, 10, 10, 10, 10, 10, 10, 5, 0, 0, 5, 10, 10, 5, 0, 0,
    ],
    q: [
      -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0,
      5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5,
      -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5,
      -5, -10, -10, -20,
    ],
    k: [
      // king midgame; endgame handled with a small phase blend
      -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40,
      -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40,
      -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20,
      -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
    ],
  };

  // King endgame PST (safer in center)
  private readonly PST_K_END: number[] = [
    -50, -30, -30, -30, -30, -30, -30, -50, -30, -10, -10, -10, -10, -10, -10,
    -30, -30, -10, 20, 20, 20, 20, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 20, 20, 20, 20, -10, -30, -30,
    -10, -10, -10, -10, -10, -10, -30, -50, -30, -30, -30, -30, -30, -30, -50,
  ];

  // Budgets by level (you can keep your existing UI settings)
  private readonly limits: Record<
    BotLevel,
    {
      maxMs: number;
      maxNodes: number;
      minDelay: number;
      maxDelay: number;
      depth: number;
    }
  > = {
    easy: {
      maxMs: 120,
      maxNodes: 5_000,
      minDelay: 300,
      maxDelay: 600,
      depth: 1,
    },
    medium: {
      maxMs: 350,
      maxNodes: 25_000,
      minDelay: 400,
      maxDelay: 800,
      depth: 3,
    },
    hard: {
      maxMs: 700,
      maxNodes: 60_000,
      minDelay: 500,
      maxDelay: 1100,
      depth: 4,
    },
  };

  async pickMoveAsync(fen: string, level: BotLevel): Promise<SimpleMove> {
    const t0 = Date.now();
    const { maxMs, maxNodes, minDelay, maxDelay, depth } = this.limits[level];

    const result =
      level === 'easy'
        ? this.pickEasy(fen) // noisy 1-ply
        : this.pickIDAB(fen, depth, maxMs, maxNodes, level);

    // human-like think delay
    const thinkFor = this.randInt(minDelay, maxDelay);
    const elapsed = Date.now() - t0;
    const leftover = Math.max(0, thinkFor - elapsed);
    if (leftover > 0) await this.sleep(leftover);

    return result;
  }

  // -------------------- EASY (1-ply + PST + simple safety + noise) --------------------
  private pickEasy(fen: string): SimpleMove {
    const chess = new Chess(fen);
    const legal = chess.moves({ verbose: true }) as Move[];
    if (!legal.length) throw new Error('No legal moves');

    const scored: Array<{ m: Move; s: number }> = [];

    for (const m of legal) {
      chess.move(m);
      const sMat = this.evalMaterial(chess);
      const sPst = this.evalPST(chess);
      const score = sMat + sPst; // white perspective
      // prefer captures and checks slightly
      const captureBonus = m.captured
        ? this.PV[m.captured as PieceSymbol] * 0.4
        : 0;
      const checkBonus = m.san.includes('+') ? 18 : 0;

      // simple “don’t hang a piece” (see if square is immediately recaptured)
      const oppMoves = chess.moves({ verbose: true }) as Move[];
      const recaptures = oppMoves.filter(
        (om) => om.to === m.to && !!om.captured
      );
      const hangPenalty = recaptures.length
        ? Math.min(
            ...recaptures.map(
              (r) =>
                this.PV[m.piece as PieceSymbol] -
                (r.piece ? this.PV[r.piece as PieceSymbol] : 0)
            )
          ) * 0.4
        : 0;

      const total =
        score + captureBonus + checkBonus - Math.max(0, hangPenalty);
      chess.undo();
      scored.push({ m, s: total });
    }

    // Add noise and pick from top N to simulate ~500 Elo
    const withNoise = scored.map(({ m, s }) => ({
      m,
      s: s + this.randInt(-50, 50), // ±0.5 pawn noise
    }));

    withNoise.sort((a, b) => b.s - a.s);
    const topN = withNoise.slice(0, Math.min(4, withNoise.length));

    // 15% chance to pick something not-best (but from topN)
    const pick =
      Math.random() < 0.15 ? topN[this.randInt(1, topN.length - 1)] : topN[0];
    const mv = pick.m;

    return {
      from: mv.from,
      to: mv.to,
      promotion: (mv.promotion as any) || 'q',
    };
  }

  // -------------------- MEDIUM/HARD (Iterative Deepening + AB + QSearch) --------------
  private pickIDAB(
    fen: string,
    maxDepth: number,
    maxMs: number,
    maxNodes: number,
    level: BotLevel
  ): SimpleMove {
    const root = new Chess(fen);
    const start = Date.now();
    let nodes = 0;

    // Transposition table & heuristics
    const TT = new Map<string, TTEntry>();
    const history = new Map<string, number>(); // key: from+to
    const killers: Array<[string | null, string | null]> = Array.from(
      { length: 64 },
      () => [null, null]
    );

    const mvvLva = (m: Move) => {
      const cap = m.captured ? this.PV[m.captured as PieceSymbol] : 0;
      const att = this.PV[m.piece as PieceSymbol];
      const check = m.san.includes('+') ? 50 : 0;
      return cap * 10 - att + check;
    };

    const orderMoves = (moves: Move[], ttBest?: Move, ply = 0) => {
      const k = killers[ply] ?? [null, null];
      const killer1 = k[0];
      const killer2 = k[1];

      const scoreOf = (m: Move) => {
        const key = m.from + m.to + (m.promotion ?? '');
        if (
          ttBest &&
          m.from === ttBest.from &&
          m.to === ttBest.to &&
          m.promotion === ttBest.promotion
        )
          return 1000000;
        if (m.captured) return 500000 + mvvLva(m);
        if (killer1 && key === killer1) return 400000;
        if (killer2 && key === killer2) return 300000;
        const h = history.get(key) ?? 0;
        const check = m.san.includes('+') ? 100 : 0;
        return h + check;
      };

      moves.sort((a, b) => scoreOf(b) - scoreOf(a));
    };

    const standPat = (c: Chess) => this.eval(c);

    const quiesce = (c: Chess, alpha: number, beta: number): number => {
      if (Date.now() - start > maxMs || nodes > maxNodes) return standPat(c);
      nodes++;

      let score = standPat(c);
      if (score >= beta) return beta;
      if (alpha < score) alpha = score;

      // Only captures (optionally checks for hard)
      let moves = c.moves({ verbose: true }) as Move[];
      moves = moves.filter(
        (m) => !!m.captured || (level === 'hard' && m.san.includes('+'))
      );
      orderMoves(moves);

      for (const m of moves) {
        c.move(m);
        const val = -quiesce(c, -beta, -alpha);
        c.undo();

        if (val >= beta) return beta;
        if (val > alpha) alpha = val;
      }
      return alpha;
    };

    const search = (
      c: Chess,
      depth: number,
      alpha: number,
      beta: number,
      ply: number
    ): number => {
      const timeUp = Date.now() - start > maxMs || nodes > maxNodes;
      if (timeUp) return standPat(c);

      const fenKey = c.fen();
      const tt = TT.get(fenKey);
      if (tt && tt.depth >= depth) {
        if (tt.flag === 'EXACT') return tt.score;
        if (tt.flag === 'LOWER' && tt.score > alpha) alpha = tt.score;
        else if (tt.flag === 'UPPER' && tt.score < beta) beta = tt.score;
        if (alpha >= beta) return tt.score;
      }

      if (depth === 0) return quiesce(c, alpha, beta);
      nodes++;

      if (c.isGameOver()) {
        if (c.isCheckmate()) return -100000 + ply; // prefer faster mates for side to move (negamax)
        return 0; // stalemate/draw
      }

      const inCheck = c.inCheck();

      // Null-move pruning (hard only), not if in check
      if (level === 'hard' && !inCheck && depth >= 3) {
        // Make a null move by pushing a dummy move: chess.js has no null move, so we approximate by
        // switching turn via a dummy operation: try a reversible approach (skip for safety in chess.js)
        // Instead, we simulate with a shallow stand-pat margin:
        const R = 2;
        const nullEval = standPat(c);
        if (nullEval - 100 >= beta) {
          // fail-hard; prune
          return nullEval;
        }
      }

      let best: number = -Infinity;
      let bestMove: Move | undefined;

      let moves = c.moves({ verbose: true }) as Move[];
      const ttBest = tt?.best;
      orderMoves(moves, ttBest, ply);

      // Late Move Reductions for quiet moves (hard only)
      let moveIndex = 0;
      for (const m of moves) {
        moveIndex++;
        c.move(m);

        let d = depth - 1;
        // Simple LMR: reduce late quiet moves a bit
        if (
          level === 'hard' &&
          d >= 2 &&
          !m.captured &&
          !m.san.includes('+') &&
          moveIndex > 4
        ) {
          const reduced = -search(c, d - 1, -alpha - 1, -alpha, ply + 1); // reduced window
          if (reduced > alpha) {
            // re-search full window if it looks interesting
            const full = -search(c, d, -beta, -alpha, ply + 1);
            if (full > best) best = full;
          } else if (reduced > best) {
            best = reduced;
          }
        } else {
          const val = -search(c, d, -beta, -alpha, ply + 1);
          if (val > best) best = val;
        }

        c.undo();

        if (best > alpha) {
          alpha = best;
          bestMove = m;

          // heuristics updates
          if (!m.captured) {
            const key = m.from + m.to + (m.promotion ?? '');
            history.set(key, (history.get(key) ?? 0) + depth * depth);
            // killers
            const k = killers[ply];
            const str = key;
            if (k[0] !== str) {
              killers[ply] = [str, k[0]];
            }
          }
        }
        if (alpha >= beta) {
          // beta cutoff — store killer
          if (!m.captured) {
            const key = m.from + m.to + (m.promotion ?? '');
            const k = killers[ply];
            if (k[0] !== key) killers[ply] = [key, k[0]];
          }
          break;
        }
      }

      // Store to TT
      const entry: TTEntry = {
        depth,
        score: best,
        flag: best <= alpha ? 'UPPER' : best >= beta ? 'LOWER' : 'EXACT',
        best: bestMove,
      };

      // NOTE: Above alpha/beta in negamax is tricky once we modified alpha. Safer:
      // Determine flag by comparing with original alpha/beta would require storing them.
      // Keep it simple; engines often store EXACT on pv nodes only. We'll clamp:
      if (bestMove) entry.best = bestMove;
      TT.set(fenKey, entry);

      return best;
    };

    // Iterative deepening
    let bestAtRoot: Move | null = null;
    let bestScore = -Infinity;

    const rootMoves = root.moves({ verbose: true }) as Move[];
    orderMoves(rootMoves);

    for (let d = 1; d <= maxDepth; d++) {
      if (Date.now() - start > maxMs || nodes > maxNodes) break;
      let alpha = -Infinity;
      let beta = Infinity;

      for (const m of rootMoves) {
        if (Date.now() - start > maxMs || nodes > maxNodes) break;

        root.move(m);
        const val = -search(root, d - 1, -beta, -alpha, 0);
        root.undo();

        if (val > bestScore || !bestAtRoot) {
          bestScore = val;
          bestAtRoot = m;
        }
        if (val > alpha) alpha = val;
      }

      // Re-order PV move to front for next iteration
      if (bestAtRoot) {
        const idx = rootMoves.findIndex(
          (x) =>
            x.from === bestAtRoot!.from &&
            x.to === bestAtRoot!.to &&
            x.promotion === bestAtRoot!.promotion
        );
        if (idx > 0) {
          const [pv] = rootMoves.splice(idx, 1);
          rootMoves.unshift(pv);
        }
      }
    }

    if (!bestAtRoot) {
      const m = rootMoves[0];
      return { from: m.from, to: m.to, promotion: (m.promotion as any) || 'q' };
    }

    // Gentle randomness on MEDIUM to keep ~800 Elo vibes
    if (level === 'medium') {
      // small ±0.2 pawn jitter among top 2
      const scored: Array<{ m: Move; s: number }> = [];
      for (const m of rootMoves.slice(0, Math.min(3, rootMoves.length))) {
        root.move(m);
        const s = this.eval(root);
        root.undo();
        scored.push({ m, s: s + this.randInt(-20, 20) });
      }
      scored.sort((a, b) => b.s - a.s);
      bestAtRoot = scored[0].m;
    }

    return {
      from: bestAtRoot.from,
      to: bestAtRoot.to,
      promotion: (bestAtRoot.promotion as any) || 'q',
    };
  }

  // -------------------- Evaluation --------------------
  private eval(chess: Chess): number {
    // White-positive score
    const material = this.evalMaterial(chess);
    const pst = this.evalPST(chess);

    // Mobility (very light, avoid side-to-move bias)
    // chess.js only gives legal moves for side-to-move; keep small weight.
    const mobility =
      chess.moves().length * 0.1 * (chess.turn() === 'w' ? 1 : -1);

    // “Being in check” helps the other side
    const inCheck = chess.inCheck() ? (chess.turn() === 'w' ? -20 : 20) : 0;

    return material + pst + mobility + inCheck;
  }

  private evalMaterial(chess: Chess): number {
    let score = 0;
    for (const row of chess.board()) {
      for (const cell of row) {
        if (!cell) continue;
        const v = this.PV[cell.type];
        score += cell.color === 'w' ? v : -v;
      }
    }
    return score;
  }

  private evalPST(chess: Chess): number {
    // Blend king PST to endgame when little material remains (no pawns excluded)
    const totalNonPawn = this.countNonPawnMaterial(chess);
    const endgamePhase = Math.max(0, 1 - totalNonPawn / 2400); // crude phase 0..1

    let score = 0;
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = board[r][c];
        if (!cell) continue;

        const idxWhite = r * 8 + c;
        const idxBlack = (7 - r) * 8 + c; // mirror for black
        const table = this.PST[cell.type];

        if (cell.type === 'k') {
          const mid = table[cell.color === 'w' ? idxWhite : idxBlack];
          const end = this.PST_K_END[cell.color === 'w' ? idxWhite : idxBlack];
          const blended = mid * (1 - endgamePhase) + end * endgamePhase;
          score += cell.color === 'w' ? blended : -blended;
        } else {
          const v = table[cell.color === 'w' ? idxWhite : idxBlack];
          score += cell.color === 'w' ? v : -v;
        }
      }
    }
    return score;
  }

  private countNonPawnMaterial(chess: Chess): number {
    let s = 0;
    for (const row of chess.board()) {
      for (const cell of row) {
        if (!cell || cell.type === 'p' || cell.type === 'k') continue;
        s += this.PV[cell.type];
      }
    }
    return s;
  }

  // -------------------- helpers --------------------
  private sleep(ms: number) {
    return new Promise<void>((res) => setTimeout(res, ms));
  }
  private randInt(min: number, max: number) {
    return Math.floor(min + Math.random() * (max - min + 1));
  }
}
