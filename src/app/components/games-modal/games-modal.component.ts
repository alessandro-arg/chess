import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of, combineLatest } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { NotificationService, GameDoc } from '../../notification.service';
import { UserService } from '../../user.service';

type Outcome = 'W' | 'L' | 'D';

type VmItem = {
  id: string;
  outcome: Outcome;
  boxClass: string;
  textClass: string;
  opponentLabel: string; // already resolved (BOT/Unknown/name/uid)
  statusLabel: string;
  whenLabel: string;
};

type Vm = { items: VmItem[]; error: string | null };

@Component({
  selector: 'app-games-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './games-modal.component.html',
})
export class GamesModalComponent implements OnInit {
  @Input({ required: true }) uid!: string;
  @Output() close = new EventEmitter<void>();

  vm$!: Observable<Vm>;

  trackById = (_: number, it: VmItem) => it.id;

  constructor(
    private readonly notifier: NotificationService,
    private readonly userService: UserService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.vm$ = of(this.uid).pipe(
      switchMap((uid) => {
        if (!uid) return of<Vm>({ items: [], error: null });

        // 1) Load the games for current user
        return this.notifier.gamesForUser$(uid, 50).pipe(
          // 2) For each game, resolve opponent label (never in template)
          switchMap((games) => {
            if (!games?.length) return of<Vm>({ items: [], error: null });

            const itemStreams = games.map((g) => {
              const w = g?.players?.white ?? null;
              const b = g?.players?.black ?? null;
              const myIsWhite = w === uid;
              const myIsBlack = b === uid;

              // Defensive: should always be true because of query, but guard anyway
              if (!myIsWhite && !myIsBlack) {
                return of<VmItem>(this.makeItem(uid, g, 'Unknown'));
              }

              const ouid = myIsWhite ? b : w;

              // Resolve opponent label without calling Firestore for invalid/BOT/empty
              if (!ouid || ouid === 'BOT' || ouid === '') {
                const label = ouid === 'BOT' ? 'BOT' : 'Unknown';
                return of<VmItem>(this.makeItem(uid, g, label));
              }

              // Safe Firestore lookup for opponent profile
              return this.userService.userProfile$(ouid).pipe(
                map((opp) => this.makeItem(uid, g, opp?.displayName || ouid)),
                catchError(() => of(this.makeItem(uid, g, ouid)))
              );
            });

            return combineLatest(itemStreams).pipe(
              map((items) => ({ items, error: null as string | null }))
            );
          }),
          catchError((err) => {
            const msg =
              err?.code === 'failed-precondition'
                ? 'Index not ready. Open Firestore console to create the suggested index.'
                : err?.code === 'permission-denied'
                ? 'You don’t have permission to read games. Check Firestore security rules.'
                : 'Could not load games.';
            return of<Vm>({ items: [], error: msg });
          })
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  // --- pure helpers used ONLY inside the stream (not in the template) ---

  private makeItem(myUid: string, g: GameDoc, opponentLabel: string): VmItem {
    const outcome = this.outcomeForUser(myUid, g);
    const classes = this.outcomeClasses(outcome);
    const when = this.timeAgo(g?.finishedAt || g?.updatedAt || g?.createdAt);

    return {
      id: g.id,
      outcome,
      boxClass: classes.box,
      textClass: classes.text,
      opponentLabel,
      statusLabel: g?.status || '—',
      whenLabel: when,
    };
  }

  private outcomeForUser(myUid: string, g: GameDoc): Outcome {
    const w = g?.players?.white ?? null;
    const b = g?.players?.black ?? null;
    const myIsWhite = w === myUid;
    const myIsBlack = b === myUid;

    switch (g?.result) {
      case '1-0':
        return myIsWhite ? 'W' : 'L';
      case '0-1':
        return myIsBlack ? 'W' : 'L';
      case '1/2-1/2':
        return 'D';
      default:
        return 'D';
    }
  }

  private outcomeClasses(o: Outcome) {
    return {
      box:
        o === 'W'
          ? 'bg-green-500/20'
          : o === 'L'
          ? 'bg-red-500/20'
          : 'bg-gray-500/20',
      text:
        o === 'W'
          ? 'text-green-400'
          : o === 'L'
          ? 'text-red-400'
          : 'text-gray-400',
    };
  }

  private timeAgo(d?: any): string {
    const dt = d?.toDate ? (d.toDate() as Date) : d instanceof Date ? d : null;
    if (!dt) return '';
    const diff = Date.now() - dt.getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const ddd = Math.floor(h / 24);
    if (ddd < 7) return `${ddd}d ago`;
    const w = Math.floor(ddd / 7);
    if (w < 5) return `${w}w ago`;
    const mo = Math.floor(ddd / 30);
    if (mo < 12) return `${mo}mo ago`;
    const y = Math.floor(ddd / 365);
    return `${y}y ago`;
  }

  goAnalysis(gameId: string) {
    this.router.navigate(['/', this.uid, 'analysis'], {
      queryParams: { game: gameId },
    });
    this.close.emit();
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.close.emit();
  }
}
