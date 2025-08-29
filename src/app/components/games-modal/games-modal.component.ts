import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of, shareReplay, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { NotificationService, GameDoc } from '../../notification.service';
import { UserService, UserProfile } from '../../user.service';

@Component({
  selector: 'app-games-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './games-modal.component.html',
})
export class GamesModalComponent implements OnInit {
  @Input({ required: true }) uid!: string;
  @Output() close = new EventEmitter<void>();

  games$?: Observable<GameDoc[]>;

  constructor(
    private readonly notifier: NotificationService,
    private readonly userService: UserService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    // fetch "all" (or many) — the UI will only scroll after ~5 items
    this.games$ = of(this.uid).pipe(
      switchMap((uid) => (uid ? this.notifier.gamesForUser$(uid, 50) : of([]))),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  opponentUid(g: GameDoc): string {
    const w = g.players?.white || '';
    const b = g.players?.black || '';
    return w === this.uid ? b : w;
  }

  profile$(uid: string): Observable<UserProfile | null> {
    return this.userService.userProfile$(uid);
  }

  outcomeForUser(g: GameDoc): 'W' | 'L' | 'D' {
    const asWhite = g.players?.white === this.uid;
    switch (g.result) {
      case '1-0':
        return asWhite ? 'W' : 'L';
      case '0-1':
        return asWhite ? 'L' : 'W';
      case '1/2-1/2':
        return 'D';
      default:
        return 'D';
    }
  }

  outcomeBox(o: 'W' | 'L' | 'D') {
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

  timeAgo(d?: any): string {
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
}
