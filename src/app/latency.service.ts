import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Database,
  ref,
  set,
  serverTimestamp as rtdbServerTs,
  onValue,
} from '@angular/fire/database';
import { Auth } from '@angular/fire/auth';

@Injectable({ providedIn: 'root' })
export class LatencyService {
  private timer: any;
  private readonly alpha = 0.3; // smoothing factor for EWMA

  private _latency$ = new BehaviorSubject<number | null>(null);
  latency$ = this._latency$.asObservable();

  // live connected flag from RTDB
  connected$: Observable<boolean>;

  // optional: parse region from DB URL for the footer “Server: …”
  serverLabel = 'RTDB';
  region: string | null = null;

  constructor(
    private db: Database,
    private auth: Auth,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // connection state
    this.connected$ = new Observable<boolean>((sub) => {
      const r = ref(this.db, '.info/connected');
      const off = onValue(
        r,
        (s) => sub.next(!!s.val()),
        (err) => sub.error(err)
      );
      return () => off();
    });

    // try to derive region from databaseURL
    const url = (this.db as any).app?.options?.databaseURL as
      | string
      | undefined;
    if (url) {
      const m = url.match(
        /https:\/\/[^.]+\.([a-z0-9-]+)\.firebasedatabase\.app/i
      );
      if (m) this.region = m[1];
      this.serverLabel = this.region ? `RTDB/${this.region}` : 'RTDB';
    }
  }

  start(periodMs = 5000) {
    if (!isPlatformBrowser(this.platformId)) return; // SSR safe
    if (this.timer) return;
    this.pingOnce();
    this.timer = setInterval(() => this.pingOnce(), periodMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async pingOnce() {
    try {
      const uid = this.auth.currentUser?.uid ?? 'anon';
      const key = uid; // 1 key per user; keeps it tiny
      const t0 = performance.now();

      // write a tiny object; server will fill `at` with server time
      await set(ref(this.db, `_ping/${key}`), { at: rtdbServerTs() });

      const rtt = performance.now() - t0; // round-trip in ms

      // smooth it a bit so the number doesn’t jitter
      const prev = this._latency$.value ?? rtt;
      const smoothed = prev * (1 - this.alpha) + rtt * this.alpha;

      this._latency$.next(Math.round(smoothed));
    } catch {
      // network hiccup? Leave last value.
    }
  }
}
