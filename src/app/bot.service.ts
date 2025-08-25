import { Injectable } from '@angular/core';
import { Chess } from 'chess.js';
import type { Move, PieceSymbol } from 'chess.js';

export type BotLevel = 'easy' | 'medium' | 'hard';
type SimpleMove = {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
};

@Injectable({ providedIn: 'root' })
export class BotService {
  // piece values (centipawns) — strictly typed by PieceSymbol
  private readonly PV: Record<PieceSymbol, number> = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 0,
  };

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
        ? this.pickEasy(fen)
        : this.pickSearch(fen, depth, maxMs, maxNodes);

    // human-like delay
    const thinkFor = this.randInt(minDelay, maxDelay);
    const elapsed = Date.now() - t0;
    const leftover = Math.max(0, thinkFor - elapsed);
    if (leftover > 0) await this.sleep(leftover);

    return result;
  }

  // -------------------- EASY (1-ply + simple safety) --------------------
  private pickEasy(fen: string): SimpleMove {
    const chess = new Chess(fen);
    const legal = chess.moves({ verbose: true }) as Move[];
    if (!legal.length) throw new Error('No legal moves');

    let best = legal[0];
    let bestScore = -Infinity;

    for (const m of legal) {
      chess.move(m);
      const score = this.evalMaterial(chess) * (chess.turn() === 'w' ? 1 : -1);
      const captureBonus = m.captured
        ? this.PV[m.captured as PieceSymbol] * 0.6
        : 0;
      const checkBonus = m.san.includes('+') ? 20 : 0;

      // “don’t hang a piece” heuristic
      const oppMoves = chess.moves({ verbose: true }) as Move[];
      const recaptures = oppMoves.filter(
        (om) => om.to === m.to && !!om.captured
      );
      const hangPenalty = recaptures.length
        ? Math.min(
            ...recaptures.map(
              (r) => this.PV[m.piece] - (r.piece ? this.PV[r.piece] : 0)
            )
          ) * 0.5
        : 0;

      const total =
        score + captureBonus + checkBonus - Math.max(0, hangPenalty);
      chess.undo();

      if (total > bestScore) {
        bestScore = total;
        best = m;
      }
    }

    return {
      from: best.from,
      to: best.to,
      promotion: (best.promotion as any) || 'q',
    };
  }

  // -------------------- MEDIUM/HARD (alpha-beta + quiescence) --------------------
  private pickSearch(
    fen: string,
    depth: number,
    maxMs: number,
    maxNodes: number
  ): SimpleMove {
    const root = new Chess(fen);
    const start = Date.now();
    let nodes = 0;

    const orderMoves = (list: Move[]) => {
      // prioritize captures + checks
      return list.sort((a, b) => {
        const ac = a.captured ? this.PV[a.captured as PieceSymbol] : 0;
        const bc = b.captured ? this.PV[b.captured as PieceSymbol] : 0;
        const aCheck = a.san.includes('+') ? 1 : 0;
        const bCheck = b.san.includes('+') ? 1 : 0;
        return bc + bCheck * 10 - (ac + aCheck * 10);
      });
    };

    const standPat = (c: Chess) => this.eval(c);

    const quiesce = (chess: Chess, alpha: number, beta: number): number => {
      if (Date.now() - start > maxMs || nodes > maxNodes)
        return standPat(chess);
      nodes++;

      let score = standPat(chess);
      if (score >= beta) return beta;
      if (alpha < score) alpha = score;

      const moves = (chess.moves({ verbose: true }) as Move[]).filter(
        (m) => !!m.captured
      );
      orderMoves(moves);
      for (const m of moves) {
        chess.move(m);
        const val = -quiesce(chess, -beta, -alpha);
        chess.undo();

        if (val >= beta) return beta;
        if (val > alpha) alpha = val;
      }
      return alpha;
    };

    const search = (
      chess: Chess,
      d: number,
      alpha: number,
      beta: number
    ): number => {
      if (Date.now() - start > maxMs || nodes > maxNodes)
        return standPat(chess);
      if (d === 0) return quiesce(chess, alpha, beta);

      nodes++;

      if (chess.isGameOver()) {
        if (chess.isCheckmate()) return -10_000 + d; // prefer faster mate for side to move
        return 0;
      }

      let best = -Infinity;
      const moves = chess.moves({ verbose: true }) as Move[];
      orderMoves(moves);

      for (const m of moves) {
        chess.move(m);
        const val = -search(chess, d - 1, -beta, -alpha);
        chess.undo();

        if (val > best) best = val;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
      }

      return best;
    };

    // root pick
    let bestMove: Move | null = null;
    let bestScore = -Infinity;
    const rootMoves = root.moves({ verbose: true }) as Move[];
    orderMoves(rootMoves);

    for (const m of rootMoves) {
      root.move(m);
      const val = -search(root, depth - 1, -Infinity, Infinity);
      root.undo();
      if (val > bestScore) {
        bestScore = val;
        bestMove = m;
      }
      if (Date.now() - start > maxMs || nodes > maxNodes) break;
    }

    if (!bestMove) {
      const m = rootMoves[0];
      return { from: m.from, to: m.to, promotion: (m.promotion as any) || 'q' };
    }
    return {
      from: bestMove.from,
      to: bestMove.to,
      promotion: (bestMove.promotion as any) || 'q',
    };
  }

  // -------------------- evaluation --------------------
  private eval(chess: Chess): number {
    const material = this.evalMaterial(chess);
    const turn = chess.turn(); // 'w' | 'b'
    const mobility = chess.moves().length * 0.1 * (turn === 'w' ? 1 : -1);
    const inCheck = chess.inCheck() ? (turn === 'w' ? -15 : 15) : 0; // NOTE: inCheck(), not in_check()
    return material + mobility + inCheck;
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

  // -------------------- helpers --------------------
  private sleep(ms: number) {
    return new Promise<void>((res) => setTimeout(res, ms));
  }
  private randInt(min: number, max: number) {
    return Math.floor(min + Math.random() * (max - min + 1));
  }
}
