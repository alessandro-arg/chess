import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { environment } from '../environments/environment';

export type BotLevel = 'easy' | 'medium' | 'hard';
type SimpleMove = {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
};

@Injectable({ providedIn: 'root' })
export class BotService {
  private base = environment.apiBase || '';

  constructor(private http: HttpClient) {}

  async pickMoveAsync(fen: string, level: BotLevel): Promise<SimpleMove> {
    const res = await lastValueFrom(
      this.http.post<{ bestmove: string }>(`${this.base}/api/engine/bestmove`, {
        fen,
        level,
      })
    );

    const uci = (res?.bestmove || '').trim();
    if (!uci || uci === '(none)') throw new Error('Engine returned no move');

    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promo = uci[4] as any;
    return { from, to, promotion: promo || undefined };
  }
}
