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
import { GameRtdbService } from '../../game-rtdb.service';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';

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
  liveGame: any;
  myClockDisplay = '15:00';
  oppClockDisplay = '15:00';
  serverOffset = 0;
  offsetSub?: Subscription;
  rtdbSub?: Subscription;
  clockTick?: any;

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
    private userService: UserService,
    private rtdbGame: GameRtdbService
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

    this.preloadPieces();
  }

  ngOnDestroy(): void {
    this.inviteSub?.unsubscribe();
    this.gameSub?.unsubscribe();
    this.profilesSub?.unsubscribe();
    if (this.gameId && this.myUid)
      this.notifier.leaveGame(this.gameId, this.myUid).catch(() => {});
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.participantsSub?.unsubscribe();
    this.offsetSub?.unsubscribe();
    this.rtdbSub?.unsubscribe();
    if (this.clockTick) clearInterval(this.clockTick);
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
    return this.myElo != null ? String(this.myElo) : 'null';
  }

  get oppEloDisplay(): string {
    return this.oppElo != null ? String(this.oppElo) : 'null';
  }

  pieceSrc(code: string | null): string {
    if (!code) return '';
    const type = code.toUpperCase();
    const color = code === type ? 'w' : 'b';
    return `assets/chess/${color}${type}.png`;
  }

  private preloadPieces() {
    const codes = ['K', 'Q', 'R', 'B', 'N', 'P'];
    const colors = ['w', 'b'];
    for (const c of colors) {
      for (const t of codes) {
        const img = new Image();
        img.src = `assets/chess/${c}${t}.png`;
      }
    }
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
    if (!this.gameId || !this.myUid || !game.players) return;

    // 1) Who am I? Who's the opponent?
    const white = game.players.white;
    const black = game.players.black;

    this.myColor = white === this.myUid ? 'white' : 'black';
    this.oppUid = this.myColor === 'white' ? black : white;

    // 2) Flip board orientation so the local player is on the bottom
    //    Also flip file/rank labels used for coordinates & rendering.
    const FILES_W = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const RANKS_W = ['8', '7', '6', '5', '4', '3', '2', '1'];
    const FILES_B = [...FILES_W].reverse();
    const RANKS_B = [...RANKS_W].reverse();

    this.files = this.myColor === 'white' ? FILES_W : FILES_B;
    this.ranks = this.myColor === 'white' ? RANKS_W : RANKS_B;

    // 3) Firestore presence (your existing system)
    this.notifier.joinGame(this.gameId, this.myUid).catch(console.error);
    if (!this.heartbeat) {
      this.heartbeat = setInterval(() => {
        if (this.gameId && this.myUid) {
          this.notifier.touchGame(this.gameId, this.myUid).catch(() => {});
        }
      }, 30_000);
    }

    // 4) Load/keep profiles (you + opponent)
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

    // 5) Participants list (optional, keep your existing code)
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
        console.log('[Game participants]', list);
      });

    // 6) RTDB server time offset (for fair clocks)
    this.offsetSub?.unsubscribe();
    this.offsetSub = this.rtdbGame.serverOffset$().subscribe((o) => {
      this.serverOffset = o ?? 0;
    });

    // 7) RTDB live game stream
    this.rtdbSub?.unsubscribe();
    this.rtdbSub = this.rtdbGame.game$(this.gameId).subscribe((g) => {
      if (!g) return;
      // Apply FEN -> board
      this.applyFen(g.fen);
      // Flip the rendered board for Black so they see their pieces at bottom
      if (this.myColor === 'black') {
        this.board = this.board.map((row) => [...row].reverse()).reverse();
      }
      // Update clocks using server offset
      this.updateClocksDisplay(g, this.serverOffset);
      // RTDB presence (separate from Firestore presence)
      this.rtdbGame.join(this.gameId!, this.myUid!).catch(() => {});
      // Cache latest game
      this.liveGame = g;
    });

    // 8) Smooth clock countdown in UI
    if (this.clockTick) clearInterval(this.clockTick);
    this.clockTick = setInterval(() => {
      if (this.liveGame) {
        this.updateClocksDisplay(this.liveGame, this.serverOffset);
      }
    }, 200);
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

  getCoordTextClass(row: number, col: number): string {
    return this.isLightSquare(row, col) ? 'text-slate-700' : 'text-white';
  }

  isLightSquare(row: number, col: number): boolean {
    return (row + col) % 2 === 0;
  }

  toAlgebraic(row: number, col: number): string {
    // row=0 is rank 8, col=0 is file a
    const file = this.files[col];
    const rank = this.ranks[row]; // ranks[] = ['8','7',...,'1']
    return `${file}${rank}`;
  }

  handleSquareClick(row: number, col: number): void {
    const squareId = `${col}-${row}`;
    if (this.selectedSquare) {
      if (this.selectedSquare === squareId) {
        this.selectedSquare = null;
        this.highlightedSquares = [];
      } else {
        const [fromCol, fromRow] = this.selectedSquare.split('-').map(Number);
        const from = this.toAlgebraic(fromRow, fromCol);
        const to = this.toAlgebraic(row, col);
        this.selectedSquare = null;
        this.highlightedSquares = [];

        if (this.gameId) {
          // NOTE: handle promotion UI later; default queen
          this.rtdbGame
            .tryMove(this.gameId, { from, to, promotion: 'q' })
            .catch((err) => console.warn('illegal/failed move', err));
        }
      }
    } else {
      if (this.board[row][col]) {
        this.selectedSquare = squareId;
        // (optional) highlight legal moves by running chess.js locally from live FEN
        const c = new Chess(this.liveGame?.fen);
        const from = this.toAlgebraic(row, col);
        const moves = c.moves({
          square: from as Square,
          verbose: true,
        }) as Array<{ to: string }>;
        this.highlightedSquares = moves.map((m) => {
          const file = m.to[0]; // 'a'..'h'
          const rank = m.to[1]; // '1'..'8'
          const fIndex = this.files.indexOf(file);
          const rIndex = this.ranks.indexOf(rank);
          return `${fIndex}-${rIndex}`;
        });
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
    if (!this.gameId) return;
    this.rtdbGame.offerDraw(this.gameId).catch(() => {});
    this.closeGameMenu();
  }

  resign(): void {
    if (!this.gameId) return;
    this.rtdbGame.resign(this.gameId).catch(() => {});
    this.closeGameMenu();
  }

  applyFen(fen: string) {
    // you already render a board matrix; use chess.js to expand from fen
    const c = new Chess(fen);
    const b = c.board(); // 8x8 array of {type,color} | null, rank 8 -> 1
    this.board = b.map((row) =>
      row.map((cell) =>
        cell ? (cell.color === 'w' ? cell.type.toUpperCase() : cell.type) : null
      )
    );
    this.liveGame = { ...(this.liveGame || {}), fen };
  }

  updateClocksDisplay(g: any, offset: number) {
    this.liveGame = g;
    const now = Date.now() + (offset || 0);
    const turn = g.turn; // 'w' or 'b'
    const elapsed = Math.max(0, now - (g.lastMoveAt || now));
    const w = g.remainingMs?.w ?? 0;
    const b = g.remainingMs?.b ?? 0;
    const wNow =
      turn === 'w' && g.status === 'active' ? Math.max(0, w - elapsed) : w;
    const bNow =
      turn === 'b' && g.status === 'active' ? Math.max(0, b - elapsed) : b;
    const fmt = (ms: number) => {
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      const r = s % 60;
      return `${m}:${r.toString().padStart(2, '0')}`;
    };
    const meWhite = this.myColor === 'white';
    this.myClockDisplay = fmt(meWhite ? wNow : bNow);
    this.oppClockDisplay = fmt(meWhite ? bNow : wNow);
  }
}
