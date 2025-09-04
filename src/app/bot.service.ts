import { Injectable } from '@angular/core';

export type BotLevel = 'easy' | 'medium' | 'hard';
type SimpleMove = {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
};

@Injectable({ providedIn: 'root' })
export class BotService {
  private worker?: Worker;
  private inFlight?: {
    resolve: (m: SimpleMove) => void;
    reject: (e: any) => void;
  };

  async pickMoveAsync(fen: string, level: BotLevel): Promise<SimpleMove> {
    if (!this.worker) this.initWorker();
    return new Promise<SimpleMove>((resolve, reject) => {
      this.inFlight = { resolve, reject };
      this.worker!.postMessage({ type: 'go', fen, level });
    });
  }

  private initWorker() {
    // Absolute path avoids baseHref/SSR issues
    this.worker = new Worker('/assets/workers/stockfish.worker.js');

    this.worker.onmessage = (e: MessageEvent) => {
      const data: any = e.data;
      if (data?.type === 'bestmove' && this.inFlight) {
        const uci: string = data.bestmove;
        this.inFlight.resolve({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: (uci[4] as any) || 'q',
        });
        this.inFlight = undefined;
      }
    };
    this.worker.onerror = (err) => {
      console.error('Stockfish worker error:', err);
      this.inFlight?.reject(err);
      this.inFlight = undefined;
    };
  }
}
