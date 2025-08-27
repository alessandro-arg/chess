import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  ViewChild,
  HostListener,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, of, combineLatest } from 'rxjs';
import { switchMap, map, distinctUntilChanged } from 'rxjs/operators';
import {
  GameDoc,
  GameInvite,
  NotificationService,
} from '../../notification.service';
import { AuthService } from '../../auth.service';
import { UserService } from '../../user.service';
import { GameRtdbService } from '../../game-rtdb.service';
import { Chess } from 'chess.js';
import { BotService, BotLevel } from '../../bot.service';
import { GameEndComponent, GameEndData } from '../game-end/game-end.component';

@Component({
  selector: 'app-chess-board',
  standalone: true,
  imports: [CommonModule, GameEndComponent],
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

  oppName: string = '';
  oppPhotoURL: string = '';
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
  vsProfile$ = of(null as any);
  gameId: string | null = null;
  gameSub?: Subscription;
  inviteSub?: Subscription;
  myUid: string | null = null;

  isBotGame = false;
  botLevel: BotLevel = 'medium';
  aiBusy = false;
  lastAIMoveAt: number | null = null;
  postedResult = false;

  confirmResignOpen = false;
  private navigatedOnGameEnd = false;

  showGameEndModal = false;
  gameEndData: GameEndData | null = null;

  @ViewChild('boardGrid', { static: false })
  boardGrid?: ElementRef<HTMLDivElement>;

  dragging = false;
  dragFrom: { row: number; col: number } | null = null;
  dragPiece: string | null = null;
  dragImageSrc = '';
  dragX = 0;
  dragY = 0;
  dragSquarePx = 64;

  dragArmed = false;
  dragArmX = 0;
  dragArmY = 0;
  dragThresholdPx = 14;

  showStartMessage = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private notifier: NotificationService,
    private auth: AuthService,
    public userService: UserService,
    private rtdbGame: GameRtdbService,
    private bot: BotService
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
      this.vsProfile$ = this.vsUid
        ? this.userService.userProfile$(this.vsUid)
        : of(null);

      // cleanup when params change
      this.inviteSub?.unsubscribe();
      this.gameSub?.unsubscribe();

      if (invite && !game) {
        this.mode = 'waiting';
        this.waiting = true;
        this.inviteId = invite;
        if (this.vsUid) this.hydrateWaitingHeader(this.vsUid);
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
      if (!this.myUid) return;
      this.router.navigate([`/${this.myUid}/chess-board`], {
        queryParams: { game: inv.gameId },
      });
    }
  }

  private hydrateWaitingHeader(vsUid: string) {
    this.profilesSub?.unsubscribe();

    const me$ = this.myUid
      ? this.userService.userProfile$(this.myUid)
      : of(null);
    const opp$ = this.userService.userProfile$(vsUid);

    this.profilesSub = combineLatest([me$, opp$]).subscribe(([me, opp]) => {
      this.myName = me?.displayName || me?.email || 'You';
      this.myPhotoURL = me?.photoURL || '../../../assets/user.png';
      this.myElo = (me as any)?.elo ?? (me as any)?.rating ?? null;
      this.oppName = opp?.displayName || opp?.email || vsUid;
      this.oppPhotoURL = opp?.photoURL || '../../../assets/user.png';
      this.oppElo = (opp as any)?.elo ?? (opp as any)?.rating ?? null;
    });
  }

  private onGameChange(game: GameDoc | null) {
    if (!game) return;
    if (!this.gameId || !this.myUid || !game.players) return;

    this.isBotGame =
      game.mode === 'bot' ||
      game.players.black === 'BOT' ||
      game.players.white === 'BOT';
    this.botLevel = game.bot?.difficulty ?? 'medium';

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

      // If opponent is the bot, label/photo:
      if (this.isBotGame) {
        this.oppName = `AI - ${this.botLevel[0].toUpperCase()}${this.botLevel.slice(
          1
        )}`;
        this.oppPhotoURL = '../../../assets/robot.png';
        this.oppElo = 600;
      } else {
        this.oppName = opp?.displayName || opp?.email || '';
        this.oppPhotoURL = opp?.photoURL || '../../../assets/user.png';
        this.oppElo = (opp as any)?.elo ?? (opp as any)?.rating ?? null;
      }
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
      });

    // 6) RTDB server time offset (for fair clocks)
    this.offsetSub?.unsubscribe();
    this.offsetSub = this.rtdbGame.serverOffset$().subscribe((o) => {
      this.serverOffset = o ?? 0;
    });

    if (game.status === 'active' && !this.liveGame) {
      // First time we see the active game → show start message
      this.showStartMessage = true;
      setTimeout(() => {
        this.showStartMessage = false;
      }, 4000); // show for 4 seconds
    }

    // 7) RTDB live game stream
    this.rtdbSub?.unsubscribe();
    this.rtdbSub = this.rtdbGame.game$(this.gameId).subscribe(async (g) => {
      if (this.isBotGame && g.status === 'active') {
        const botColor: 'w' | 'b' = g.players?.blackUid === 'BOT' ? 'b' : 'w';
        if (g.turn === botColor) {
          if (!this.aiBusy && this.lastAIMoveAt !== g.lastMoveAt) {
            this.aiBusy = true;
            this.lastAIMoveAt = g.lastMoveAt;
            try {
              const mv = await this.bot.pickMoveAsync(g.fen, this.botLevel);
              await this.rtdbGame.tryAIMove(this.gameId!, mv);
            } catch (e) {
              console.warn('AI move failed', e);
            } finally {
              this.aiBusy = false;
            }
          }
        }
      }

      // record result once
      if (!this.postedResult && g.result && g.status !== 'active') {
        this.postedResult = true;
        const statusMap: any = {
          mate: 'mate',
          draw: 'draw',
          flag: 'flag',
          resign: 'resign',
        };
        const status = statusMap[g.status] || 'finished';
        this.notifier
          .updateGameResult(this.gameId!, {
            status,
            result: g.result as '1-0' | '0-1' | '1/2-1/2' | null,
          })
          .catch(() => {});
      }

      if (!g) return;

      if (g.status !== 'active' && !this.navigatedOnGameEnd) {
        this.navigatedOnGameEnd = true;

        // figure out my outcome
        const myIsWhite = this.myColor === 'white';
        let outcome: 'win' | 'loss' | 'draw' = 'draw';
        if (g.result === '1-0') outcome = myIsWhite ? 'win' : 'loss';
        else if (g.result === '0-1') outcome = myIsWhite ? 'loss' : 'win';
        else if (g.result === '1/2-1/2') outcome = 'draw';

        // optional: stop timers
        if (this.clockTick) clearInterval(this.clockTick);

        this.gameEndData = {
          gameId: this.gameId!,
          result: g.result as '1-0' | '0-1' | '1/2-1/2',
          status: g.status as 'mate' | 'draw' | 'flag' | 'resign' | 'finished',
          myColor: this.myColor!,
          myProfile: {
            name: this.myName,
            photoURL: this.myPhotoURL,
            elo: this.myElo,
          },
          oppProfile: {
            name: this.oppName,
            photoURL: this.oppPhotoURL,
            elo: this.oppElo,
          },
          myUid: this.myUid!,
        };

        this.showGameEndModal = true;
        return;
      }

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
    if (message) console.log(message);
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

  private algebraicToCellId(sq: string): string {
    const file = sq[0]; // 'a'..'h'
    const rank = sq[1]; // '1'..'8'
    const fIndex = this.files.indexOf(file);
    const rIndex = this.ranks.indexOf(rank);
    return `${fIndex}-${rIndex}`;
  }

  private getCastleOptions(
    c: Chess
  ): Array<{ rookFrom: string; kingFrom: string; kingTo: string }> {
    const side = c.turn(); // 'w' | 'b'
    const kingFrom = side === 'w' ? 'e1' : 'e8';
    const kingMoves = c.moves({
      square: kingFrom as any,
      verbose: true,
    }) as Array<any>;
    const out: Array<{ rookFrom: string; kingFrom: string; kingTo: string }> =
      [];

    for (const m of kingMoves) {
      if (m.flags?.includes('k')) {
        out.push({
          rookFrom: side === 'w' ? 'h1' : 'h8',
          kingFrom,
          kingTo: m.to,
        }); // e1→g1 or e8→g8
      }
      if (m.flags?.includes('q')) {
        out.push({
          rookFrom: side === 'w' ? 'a1' : 'a8',
          kingFrom,
          kingTo: m.to,
        }); // e1→c1 or e8→c8
      }
    }
    return out;
  }

  handleSquareClick(row: number, col: number): void {
    const squareId = `${col}-${row}`;

    if (this.selectedSquare) {
      if (this.selectedSquare === squareId) {
        // toggle off when clicking the same square
        this.selectedSquare = null;
        this.highlightedSquares = [];
        return;
      }

      // We had something selected; decide if this is a move, a castle, or a reselection
      const [fromCol, fromRow] = this.selectedSquare.split('-').map(Number);
      const from = this.toAlgebraic(fromRow, fromCol);
      const to = this.toAlgebraic(row, col);

      const c = new Chess(this.liveGame?.fen);
      const pieceFrom = c.get(from as any);
      const pieceTo = c.get(to as any);

      // Compute castling options once
      const castles = this.getCastleOptions(c);
      const matchByRookFirst = castles.find(
        (opt) =>
          pieceFrom?.type === 'r' && opt.rookFrom === from && opt.kingTo === to
      );
      const matchByKingToRook = castles.find(
        (opt) =>
          pieceFrom?.type === 'k' &&
          opt.kingFrom === from &&
          opt.rookFrom === to
      );
      const matchByRookToKing = castles.find(
        (opt) =>
          pieceFrom?.type === 'r' &&
          opt.rookFrom === from &&
          opt.kingFrom === to
      );

      // --- Special-case: castling clicks should still trigger the castle ---
      if (matchByRookFirst && this.gameId) {
        this.selectedSquare = null;
        this.highlightedSquares = [];
        this.rtdbGame
          .tryMove(this.gameId, {
            from: matchByRookFirst.kingFrom as any,
            to: matchByRookFirst.kingTo as any,
          })
          .catch((err) =>
            console.warn('illegal/failed castle (rook-first)', err)
          );
        return;
      }
      if (matchByKingToRook && this.gameId) {
        this.selectedSquare = null;
        this.highlightedSquares = [];
        this.rtdbGame
          .tryMove(this.gameId, {
            from: matchByKingToRook.kingFrom as any,
            to: matchByKingToRook.kingTo as any,
          })
          .catch((err) =>
            console.warn('illegal/failed castle (king-to-rook)', err)
          );
        return;
      }
      if (matchByRookToKing && this.gameId) {
        this.selectedSquare = null;
        this.highlightedSquares = [];
        this.rtdbGame
          .tryMove(this.gameId, {
            from: matchByRookToKing.kingFrom as any,
            to: matchByRookToKing.kingTo as any,
          })
          .catch((err) =>
            console.warn('illegal/failed castle (rook-to-king)', err)
          );
        return;
      }

      // --- If target square has our own piece (same color), just RESELECT it ---
      if (pieceFrom && pieceTo && pieceFrom.color === pieceTo.color) {
        this.selectSquareAndShowMoves(row, col);
        return;
      }

      // --- Otherwise, attempt a normal move/capture ---
      this.selectedSquare = null;
      this.highlightedSquares = [];

      if (this.gameId) {
        this.rtdbGame
          .tryMove(this.gameId, { from, to, promotion: 'q' })
          .catch((err) => console.warn('illegal/failed move', err));
      }
      return;
    }

    // Nothing selected yet: select the piece on this square (if any)
    if (this.board[row][col]) {
      this.selectSquareAndShowMoves(row, col);
    }
  }

  getSquareClasses(row: number, col: number): string {
    const squareId = `${col}-${row}`;
    const isSelected = this.selectedSquare === squareId;
    const isHighlighted = this.highlightedSquares.includes(squareId);
    const isLight = this.isLightSquare(row, col);

    let classes =
      'relative flex items-center justify-center cursor-pointer transition-all duration-200 ';

    classes += isLight ? 'bg-slate-100 ' : 'bg-slate-700 ';

    if (isSelected) {
      classes += 'bg-sky-400/90';
    }

    if (isHighlighted) {
      classes +=
        "after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 " +
        'after:w-[40%] after:h-[40%] after:rounded-full after:bg-slate-900 after:bg-opacity-60 ';
    }

    classes += 'hover:opacity-90 ';

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
    this.confirmResignOpen = true;
  }

  cancelResign(): void {
    this.confirmResignOpen = false;
  }

  async confirmResign(): Promise<void> {
    if (!this.gameId) return;
    try {
      await this.rtdbGame.resign(this.gameId);
    } finally {
      this.confirmResignOpen = false;
      this.isGameMenuOpen = false;
    }
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

  private getSquareSizePx(): number {
    const el = this.boardGrid?.nativeElement;
    if (!el) return 64;
    const rect = el.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height) / 8;
    return size || 64;
  }

  private getBoardRect(): DOMRect | null {
    return this.boardGrid?.nativeElement?.getBoundingClientRect() ?? null;
  }

  private pointToBoardCell(
    clientX: number,
    clientY: number
  ): { row: number; col: number } | null {
    const rect = this.getBoardRect();
    if (!rect) return null;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    const col = Math.floor((x / rect.width) * 8);
    const row = Math.floor((y / rect.height) * 8);
    // Clamp just in case
    return {
      row: Math.min(7, Math.max(0, row)),
      col: Math.min(7, Math.max(0, col)),
    };
  }

  private startDraggingFromArmed(ev: PointerEvent) {
    if (!this.dragArmed || this.dragging || !this.dragFrom) return;
    this.dragging = true;
    this.dragSquarePx = this.getSquareSizePx();
    this.dragX = ev.clientX;
    this.dragY = ev.clientY;

    // Show highlights during drag (same logic as your click-select)
    const row = this.dragFrom.row;
    const col = this.dragFrom.col;
    this.selectedSquare = `${col}-${row}`;

    const c = new Chess(this.liveGame?.fen);
    const from = this.toAlgebraic(row, col);
    const moves = c.moves({ square: from as any, verbose: true }) as Array<{
      to: string;
    }>;
    let highlights = moves.map((m) => this.algebraicToCellId(m.to));

    const piece = c.get(from as any);
    if (piece?.type === 'r' && piece?.color === c.turn()) {
      const castles = this.getCastleOptions(c);
      for (const opt of castles)
        if (opt.rookFrom === from) {
          highlights.push(this.algebraicToCellId(opt.kingTo));
          highlights.push(this.algebraicToCellId(opt.kingFrom));
        }
    }
    if (piece?.type === 'k' && piece?.color === c.turn()) {
      const castles = this.getCastleOptions(c);
      for (const opt of castles)
        highlights.push(this.algebraicToCellId(opt.rookFrom));
    }

    this.highlightedSquares = Array.from(new Set(highlights));
  }

  onPointerDownSquare(row: number, col: number, ev: PointerEvent) {
    const piece = this.board[row][col];
    if (!piece) return;

    try {
      const c = new Chess(this.liveGame?.fen);
      const from = this.toAlgebraic(row, col);
      const p = c.get(from as any);
      if (!p || p.color !== c.turn()) {
        this.dragArmed = false;
        this.dragFrom = null;
        return;
      }
    } catch {
      this.dragArmed = false;
      this.dragFrom = null;
      return;
    }

    this.dragArmed = true;
    this.dragArmX = ev.clientX;
    this.dragArmY = ev.clientY;

    this.dragging = false;
    this.dragFrom = { row, col };
    this.dragPiece = piece;
    this.dragImageSrc = this.pieceSrc(piece);
    this.dragSquarePx = this.getSquareSizePx();

    this.dragX = ev.clientX;
    this.dragY = ev.clientY;

    const c = new Chess(this.liveGame?.fen);
    const from = this.toAlgebraic(row, col);
    const moves = c.moves({ square: from as any, verbose: true }) as Array<{
      to: string;
    }>;
    let highlights = moves.map((m) => this.algebraicToCellId(m.to));

    const selectedPiece = c.get(from as any);
    if (selectedPiece?.type === 'r' && selectedPiece?.color === c.turn()) {
      const castles = this.getCastleOptions(c);
      for (const opt of castles) {
        if (opt.rookFrom === from)
          highlights.push(this.algebraicToCellId(opt.kingTo));
        highlights.push(this.algebraicToCellId(opt.kingFrom));
      }
    }
    if (selectedPiece?.type === 'k' && selectedPiece?.color === c.turn()) {
      const castles = this.getCastleOptions(c);
      for (const opt of castles)
        highlights.push(this.algebraicToCellId(opt.rookFrom));
    }
    this.highlightedSquares = Array.from(new Set(highlights));
  }

  onPointerMoveBoard(ev: PointerEvent) {
    // Promote to drag if threshold passed
    if (this.dragArmed && !this.dragging) {
      const dx = ev.clientX - this.dragArmX;
      const dy = ev.clientY - this.dragArmY;
      if (dx * dx + dy * dy >= this.dragThresholdPx * this.dragThresholdPx) {
        this.startDraggingFromArmed(ev);
      }
    }
    if (!this.dragging) return;
    ev.preventDefault(); // only prevent default once dragging
    this.dragX = ev.clientX;
    this.dragY = ev.clientY;
  }

  onPointerUpBoard(ev: PointerEvent) {
    const wasDragging = this.dragging;
    this.dragArmed = false;
    if (!wasDragging) return;
    this.finishDragAt(ev.clientX, ev.clientY);
  }

  private finishDragAt(clientX: number, clientY: number) {
    if (!this.dragging) return;
    this.dragArmed = false;

    const drop = this.pointToBoardCell(clientX, clientY);
    const from = this.dragFrom;
    const piece = this.dragPiece;

    // reset drag state immediately so UI feels snappy
    this.dragging = false;
    this.dragPiece = null;

    if (!from || !piece || !drop) {
      // dropped outside / no origin → clear and bail
      this.dragFrom = null;
      this.selectedSquare = null;
      this.highlightedSquares = [];
      return;
    }

    const fromAlg = this.toAlgebraic(from.row, from.col);
    const toAlg = this.toAlgebraic(drop.row, drop.col);

    if (!this.gameId) {
      this.dragFrom = null;
      this.selectedSquare = null;
      this.highlightedSquares = [];
      return;
    }

    try {
      const c = new Chess(this.liveGame?.fen);
      const pieceFrom = c.get(fromAlg as any);
      const castles = this.getCastleOptions(c);

      const matchByRookFirst = castles.find(
        (opt) =>
          pieceFrom?.type === 'r' &&
          opt.rookFrom === fromAlg &&
          opt.kingTo === toAlg
      );
      const matchByKingToRook = castles.find(
        (opt) =>
          pieceFrom?.type === 'k' &&
          opt.kingFrom === fromAlg &&
          opt.rookFrom === toAlg
      );
      const matchByRookToKing = castles.find(
        (opt) =>
          pieceFrom?.type === 'r' &&
          opt.rookFrom === fromAlg &&
          opt.kingFrom === toAlg
      );

      const p = matchByRookFirst
        ? this.rtdbGame.tryMove(this.gameId, {
            from: matchByRookFirst.kingFrom as any,
            to: matchByRookFirst.kingTo as any,
          })
        : matchByKingToRook
        ? this.rtdbGame.tryMove(this.gameId, {
            from: matchByKingToRook.kingFrom as any,
            to: matchByKingToRook.kingTo as any,
          })
        : matchByRookToKing
        ? this.rtdbGame.tryMove(this.gameId, {
            from: matchByRookToKing.kingFrom as any,
            to: matchByRookToKing.kingTo as any,
          })
        : this.rtdbGame.tryMove(this.gameId, {
            from: fromAlg,
            to: toAlg,
            promotion: 'q',
          });

      // IMPORTANT: on resolve or reject, clear selection + previews
      Promise.resolve(p).finally(() => {
        this.dragFrom = null;
        this.selectedSquare = null;
        this.highlightedSquares = [];
      });
    } catch {
      // on any local error, also clear
      this.dragFrom = null;
      this.selectedSquare = null;
      this.highlightedSquares = [];
    }
  }

  private selectSquareAndShowMoves(row: number, col: number): void {
    this.selectedSquare = `${col}-${row}`;

    const c = new Chess(this.liveGame?.fen);
    const from = this.toAlgebraic(row, col);
    const moves = c.moves({ square: from as any, verbose: true }) as Array<{
      to: string;
    }>;
    let highlights = moves.map((m) => this.algebraicToCellId(m.to));

    const piece = c.get(from as any);

    // Extra castling hints (same logic you already use)
    if (piece?.type === 'r' && piece?.color === c.turn()) {
      const castles = this.getCastleOptions(c);
      for (const opt of castles) {
        if (opt.rookFrom === from)
          highlights.push(this.algebraicToCellId(opt.kingTo));
        highlights.push(this.algebraicToCellId(opt.kingFrom));
      }
    }
    if (piece?.type === 'k' && piece?.color === c.turn()) {
      const castles = this.getCastleOptions(c);
      for (const opt of castles)
        highlights.push(this.algebraicToCellId(opt.rookFrom));
    }

    this.highlightedSquares = Array.from(new Set(highlights));
  }

  @HostListener('window:pointerup', ['$event'])
  onWindowPointerUp(ev: PointerEvent) {
    const wasDragging = this.dragging;
    this.dragArmed = false;
    if (!wasDragging) return; // plain click → let (click) handler run
    this.finishDragAt(ev.clientX, ev.clientY);
  }

  @HostListener('window:pointermove', ['$event'])
  onWindowPointerMove(ev: PointerEvent) {
    if (this.dragArmed && !this.dragging) {
      const dx = ev.clientX - this.dragArmX;
      const dy = ev.clientY - this.dragArmY;
      if (dx * dx + dy * dy >= this.dragThresholdPx * this.dragThresholdPx) {
        this.startDraggingFromArmed(ev);
      }
    }
    if (!this.dragging) return;
    ev.preventDefault();
    this.dragX = ev.clientX;
    this.dragY = ev.clientY;
  }

  // Escape/cancel drag with ESC key
  @HostListener('window:keydown', ['$event'])
  onKeyDown(ev: KeyboardEvent) {
    if (ev.key === 'Escape' && this.dragging) {
      this.dragging = false;
      this.dragFrom = null;
      this.dragPiece = null;
      this.selectedSquare = null;
      this.highlightedSquares = [];
    }
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

  closeGameEndModal(): void {
    this.showGameEndModal = false;
    this.gameEndData = null;
  }

  handleBackToDashboard(): void {
    this.closeGameEndModal();
    this.returnToDashboard();
  }

  handleRematch(): void {
    this.closeGameEndModal();
    // Implement rematch logic here
    console.log('Rematch requested');
  }

  handleNewGame(): void {
    this.closeGameEndModal();
    // Navigate to game creation or lobby
    this.returnToDashboard();
  }

  handleAnalyze(): void {
    this.closeGameEndModal();
    // Implement game analysis logic here
    console.log('Analyze game requested');
  }
}
