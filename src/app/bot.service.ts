import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

export type BotLevel = 'easy' | 'medium' | 'hard';
type SimpleMove = {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
};

@Injectable({ providedIn: 'root' })
export class BotService {
  constructor(private http: HttpClient) {}

  async pickMoveAsync(fen: string, level: BotLevel): Promise<SimpleMove> {
    // via Angular proxy -> hits http://localhost:3030
    const res = await lastValueFrom(
      this.http.post<{ bestmove: string }>('/api/engine/bestmove', {
        fen,
        level,
      })
    );

    const uci = (res?.bestmove || '').trim(); // e.g. "e2e4" or "e7e8q"
    if (!uci || uci === '(none)') throw new Error('Engine returned no move');

    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promo = uci[4] as any; // 'q','r','b','n' or undefined
    return { from, to, promotion: promo || undefined };
  }
}
