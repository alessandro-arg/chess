import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, of, combineLatest } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import {
  GameDoc,
  GameInvite,
  NotificationService,
} from '../../notification.service';
import { AuthService } from '../../auth.service';
import { UserService } from '../../user.service';
import { GameParticipant } from '../../notification.service';

@Component({
  selector: 'app-chess-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chess-board.component.html',
  styleUrl: './chess-board.component.css',
})
export class ChessBoardComponent implements OnInit, OnDestroy {
  selectedSquare: string | null = null;
  highlightedSquares: string[] = [];
  isGameMenuOpen = false;

  participantsSub?: Subscription;
  heartbeat?: any;
  participantsEnriched: Array<{ uid: string; name: string }> = [];

  myColor: 'white' | 'black' | null = null;
  oppUid: string | null = null;

  myName = 'You';
  myPhotoURL = '../../../assets/user.png';
  myElo: number | null = null;

  oppName = 'Opponent';
  oppPhotoURL = '../../../assets/user.png';
  oppElo: number | null = null;

  profilesSub?: Subscription;

  board: (string | null)[][] = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
  ];

  pieceSymbols: { [key: string]: string } = {
    K: '♔',
    Q: '♕',
    R: '♖',
    B: '♗',
    N: '♘',
    P: '♙',
    k: '♚',
    q: '♛',
    r: '♜',
    b: '♝',
    n: '♞',
    p: '♟',
  };

  files: string[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  ranks: string[] = ['8', '7', '6', '5', '4', '3', '2', '1'];

  mode: 'waiting' | 'game' = 'game';
  waiting = false;
  inviteId: string | null = null;
  vsUid: string | null = null;
  gameId: string | null = null;
  gameSub?: Subscription;
  inviteSub?: Subscription;
  myUid: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private notifier: NotificationService,
    private auth: AuthService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.myUid = this.route.snapshot.paramMap.get('uid');
    this.auth.user$.subscribe((u) => {
      if (!this.myUid && u?.uid) this.myUid = u.uid;
    });

    // read params
    this.route.queryParamMap.subscribe((params) => {
      const invite = params.get('invite');
      const game = params.get('game');
      this.vsUid = params.get('vs');

      // cleanup when params change
      this.inviteSub?.unsubscribe();
      this.gameSub?.unsubscribe();

      if (invite && !game) {
        this.mode = 'waiting';
        this.waiting = true;
        this.inviteId = invite;
        this.inviteSub = this.notifier
          .invite$(invite)
          .subscribe((inv) => this.onInviteChange(inv));
      } else if (game) {
        this.mode = 'game';
        this.waiting = false;
        this.gameId = game;
        this.gameSub = this.notifier
          .game$(game)
          .subscribe((g) => this.onGameChange(g));
      } else {
        this.mode = 'game';
        this.waiting = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.inviteSub?.unsubscribe();
    this.gameSub?.unsubscribe();
    this.profilesSub?.unsubscribe();
    if (this.gameId && this.myUid)
      this.notifier.leaveGame(this.gameId, this.myUid).catch(() => {});
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.participantsSub?.unsubscribe();
  }

  get inRoomCount(): number {
    return this.participantsEnriched.length;
  }

  get participantsDisplay(): string {
    return this.participantsEnriched.map((p) => p.name).join(' vs ');
  }

  get opponentColor(): 'white' | 'black' | null {
    return this.myColor === 'white'
      ? 'black'
      : this.myColor === 'black'
      ? 'white'
      : null;
  }

  get myColorBadge(): string {
    return this.myColor === 'white' ? 'White' : 'Black';
  }

  get oppColorBadge(): string {
    return this.opponentColor === 'white' ? 'White' : 'Black';
  }

  get myEloDisplay(): string {
    return this.myElo != null ? String(this.myElo) : '—';
  }

  get oppEloDisplay(): string {
    return this.oppElo != null ? String(this.oppElo) : '—';
  }

  private async onInviteChange(inv: GameInvite | null) {
    if (!inv) {
      await this.returnToDashboard('Game invitation was cancelled.');
      return;
    }
    if (inv.status === 'declined') {
      await this.returnToDashboard('Your game request was declined.');
      return;
    }
    if (inv.status === 'accepted' && inv.gameId) {
      // hop into the concrete game session
      if (!this.myUid) return;
      this.router.navigate([`/${this.myUid}/chess-board`], {
        queryParams: { game: inv.gameId },
      });
    }
  }

  private onGameChange(game: GameDoc | null) {
    if (!game) return;

    // Join presence once when we know gameId & myUid
    if (this.gameId && this.myUid && game.players) {
      const white = game.players.white;
      const black = game.players.black;

      this.myColor = white === this.myUid ? 'white' : 'black';
      this.oppUid = this.myColor === 'white' ? black : white;

      // Join presence (you already have this)
      this.notifier.joinGame(this.gameId, this.myUid).catch(console.error);
      if (!this.heartbeat) {
        this.heartbeat = setInterval(() => {
          if (this.gameId && this.myUid)
            this.notifier.touchGame(this.gameId, this.myUid).catch(() => {});
        }, 30_000);
      }

      this.profilesSub?.unsubscribe();
      this.profilesSub = combineLatest([
        this.userService.userProfile$(this.myUid),
        this.oppUid ? this.userService.userProfile$(this.oppUid) : of(null),
      ]).subscribe(([me, opp]) => {
        this.myName = me?.displayName || me?.email || 'You';
        this.myPhotoURL = me?.photoURL || '../../../assets/user.png';
        this.myElo = (me as any)?.elo ?? (me as any)?.rating ?? null;

        this.oppName = opp?.displayName || opp?.email || 'Opponent';
        this.oppPhotoURL = opp?.photoURL || '../../../assets/user.png';
        this.oppElo = (opp as any)?.elo ?? (opp as any)?.rating ?? null;
      });

      // Watch participants and log with profile names
      this.participantsSub?.unsubscribe();
      this.participantsSub = this.notifier
        .participants$(this.gameId)
        .pipe(
          switchMap((parts) => {
            if (!parts.length)
              return of([] as Array<{ uid: string; name: string }>);
            const streams = parts.map((p) =>
              this.userService.userProfile$(p.uid).pipe(
                map((profile) => ({
                  uid: p.uid,
                  name: profile?.displayName || profile?.email || p.uid,
                }))
              )
            );
            return combineLatest(streams);
          })
        )
        .subscribe((list) => {
          this.participantsEnriched = list;
          // 👉 Your requested console log:
          console.log('[Game participants]', list);
        });
    }
  }

  async cancelWaiting() {
    if (!this.inviteId) return;
    try {
      await this.notifier.cancelInvite(this.inviteId);
    } finally {
      await this.returnToDashboard('Invitation cancelled.');
    }
  }

  private async returnToDashboard(message?: string) {
    if (!this.myUid) return;
    if (message) alert(message);
    // IMPORTANT: go to '/:uid/dashboard' (matches your routes)
    this.router.navigate([`/${this.myUid}/dashboard`]);
  }

  isLightSquare(row: number, col: number): boolean {
    return (row + col) % 2 === 0;
  }

  handleSquareClick(row: number, col: number): void {
    const squareId = `${col}-${row}`;

    if (this.selectedSquare) {
      if (this.selectedSquare === squareId) {
        // Deselect if clicking the same square
        this.selectedSquare = null;
        this.highlightedSquares = [];
      } else {
        // Move piece (simplified logic)
        const [fromCol, fromRow] = this.selectedSquare.split('-').map(Number);
        this.board[row][col] = this.board[fromRow][fromCol];
        this.board[fromRow][fromCol] = null;
        this.selectedSquare = null;
        this.highlightedSquares = [];
      }
    } else {
      // Select piece if there's one on the square
      if (this.board[row][col]) {
        this.selectedSquare = squareId;
        // Add some example highlighted squares for possible moves
        const possibleMoves = [
          `${col + 1}-${row}`,
          `${col - 1}-${row}`,
          `${col}-${row + 1}`,
          `${col}-${row - 1}`,
        ].filter((square) => {
          const [c, r] = square.split('-').map(Number);
          return c >= 0 && c < 8 && r >= 0 && r < 8;
        });
        this.highlightedSquares = possibleMoves;
      }
    }
  }

  getSquareClasses(row: number, col: number): string {
    const squareId = `${col}-${row}`;
    const isSelected = this.selectedSquare === squareId;
    const isHighlighted = this.highlightedSquares.includes(squareId);
    const isLight = this.isLightSquare(row, col);

    let classes =
      'relative flex items-center justify-center cursor-pointer transition-all duration-200 ';

    if (isLight) {
      classes += 'bg-slate-100 ';
    } else {
      classes += 'bg-slate-700 ';
    }

    if (isSelected) {
      classes += 'ring-4 ring-blue-400 ring-opacity-70 ';
    }

    if (isHighlighted) {
      classes +=
        "after:content-[''] after:absolute after:inset-2 after:bg-emerald-400 after:bg-opacity-30 after:rounded-full ";
    }

    classes += 'hover:shadow-lg ';

    return classes;
  }

  toggleGameMenu(): void {
    this.isGameMenuOpen = !this.isGameMenuOpen;
  }

  closeGameMenu(): void {
    this.isGameMenuOpen = false;
  }

  takeBack(): void {
    console.log('Take back move');
    this.closeGameMenu();
    // Implement take back logic
  }

  offerDraw(): void {
    console.log('Offer draw');
    this.closeGameMenu();
    // Implement offer draw logic
  }

  resign(): void {
    console.log('Resign game');
    this.closeGameMenu();
    // Implement resign logic
  }
}
