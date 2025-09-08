import { Injectable, inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import {
  Firestore,
  doc,
  docData,
  collection,
  collectionData,
  query,
  where,
  orderBy,
  limit,
} from '@angular/fire/firestore';
import { map, of, switchMap, shareReplay } from 'rxjs';

type EloBlock = { rating: number; games: number };
type EloMap = { '5': EloBlock; '10': EloBlock; '20': EloBlock };

@Injectable({ providedIn: 'root' })
export class RatingsService {
  private db = inject(Firestore);
  private auth = inject(Auth);

  /** Live Elo map for current user: { '5': {rating,games}, ... } */
  myElo$ = authState(this.auth).pipe(
    switchMap((user) => {
      if (!user) return of(null);
      const ref = doc(this.db, 'users', user.uid);
      return docData(ref).pipe(map((u: any) => (u?.elo as EloMap) ?? null));
    }),
    shareReplay(1)
  );

  /** Last rating delta for current user in a given minutes TC (5/10/20). */
  lastDeltaForTc$(minutes: 5 | 10 | 20) {
    return authState(this.auth).pipe(
      switchMap((user) => {
        if (!user) return of(0);

        const col = collection(this.db, 'games');

        // If your finalize() sets `eloAppliedAt`, prefer that for ordering:
        const qy = query(
          col,
          where('mode', '==', 'pvp'),
          where('eloComputed', '==', true),
          where('players.both', 'array-contains', user.uid),
          where('tc.minutes', '==', minutes),
          orderBy('eloAppliedAt', 'desc'), // or 'updatedAt' if you didn’t add eloAppliedAt
          limit(1)
        );

        return collectionData(qy, { idField: 'id' }).pipe(
          map((rows) => {
            if (!rows.length) return 0;
            const g: any = rows[0];

            const side: 'white' | 'black' =
              g?.players?.white === user.uid ? 'white' : 'black';

            const before = g?.ratingsBefore?.[side];
            const after = g?.ratingsAfter?.[side];

            return typeof before === 'number' && typeof after === 'number'
              ? Math.round(after - before)
              : 0;
          })
        );
      }),
      shareReplay(1)
    );
  }
}
