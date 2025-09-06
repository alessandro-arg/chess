import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../auth.service';
import { FriendsModalComponent } from '../friends-modal/friends-modal.component';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  map,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs';
import { FriendService, Friendship } from '../../friend.service';
import {
  GameInvite,
  NotificationService,
  GameDoc,
} from '../../notification.service';
import { UserProfile, UserService } from '../../user.service';
import { PresenceService } from '../../presence.service';
import { GameRtdbService } from '../../game-rtdb.service';
import { LatencyService } from '../../latency.service';
import { LiveClockComponent } from '../live-clock/live-clock.component';
import { GamesModalComponent } from '../games-modal/games-modal.component';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

type Outcome = 'W' | 'L' | 'D';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FriendsModalComponent,
    LiveClockComponent,
    GamesModalComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  currentUser: UserProfile | null = null;
  displayName: string | null = null;
  photoURL: string | null = null;
  uid: string | null = null;

  showFriendsModal = false;
  friendsModalTab: 'search' | 'requests' | 'friends' = 'search';

  showNotifPanel = false;
  incoming$?: Observable<Friendship[]>;
  unreadCount$?: Observable<number>;

  friendsPreview$: Observable<
    Array<{ uid: string; profile: UserProfile | null; online: boolean }>
  > = of([]);
  friendCount$?: Observable<number>;

  invitesIncoming$?: Observable<GameInvite[]>;
  previousOutgoing?: GameInvite[] = [];
  outgoingInvitesSub?: any;

  botDifficulty: 'easy' | 'medium' | 'hard' = 'medium';
  botMinutes = 10; // 5 | 10 | 20

  private localSeenAt$ = new BehaviorSubject<number>(0);

  latency$ = this.latencySvc.latency$;
  connected$ = this.latencySvc.connected$;
  serverLabel = this.latencySvc.serverLabel;

  recentGames$?: Observable<GameDoc[]>;
  showGamesModal = false;

  searchCtrl = new FormControl<string>('', { nonNullable: true });

  dropdownOpen = false;
  activeIndex = 0;
  selectedFriend: { uid: string; display: string; photoURL?: string } | null =
    null;

  filteredFriends$?: Observable<
    Array<{ uid: string; profile: UserProfile | null; online: boolean }>
  >;

  private lastList: Array<{
    uid: string;
    profile: UserProfile | null;
    online: boolean;
  }> = [];

  @ViewChild('friendSearchRoot', { static: false })
  friendSearchRoot?: ElementRef;

  selectedOpponentUid: string | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly friend: FriendService,
    private readonly notifier: NotificationService,
    private readonly userService: UserService,
    private readonly presence: PresenceService,
    private readonly rtdbGame: GameRtdbService,
    private latencySvc: LatencyService
  ) {
    this.auth.user$.subscribe((user) => {
      this.uid = user?.uid ?? null;
      this.displayName = user?.displayName ?? user?.email ?? null;
      this.photoURL = user?.photoURL ?? '../../../assets/user.png';
      this.currentUser = user
        ? {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            createdAt: null,
          }
        : null;
    });
    this.auth.user$.subscribe(async (user) => {
      if (!user) return;
      this.incoming$ = this.friend.incomingPending$();
      const lastSeenFriend$ = await this.notifier.lastSeenFriendReqAt$();

      this.invitesIncoming$ = this.notifier.incomingGameInvites$();
      const lastSeenGame$ = await this.notifier.lastSeenGameInviteAt$();

      this.unreadCount$ = combineLatest([
        this.incoming$,
        lastSeenFriend$,
        this.invitesIncoming$,
        lastSeenGame$,
        this.localSeenAt$,
      ]).pipe(
        map(
          ([
            incomingFriends,
            lastFriend,
            incomingInvites,
            lastGame,
            localSeen,
          ]) => {
            const seenF = Math.max(lastFriend ?? 0, localSeen ?? 0);
            const seenG = Math.max(lastGame ?? 0, localSeen ?? 0);

            const friendUnread = (incomingFriends || []).filter((r: any) => {
              const m = r?.updatedAt?.toMillis?.() ?? 0;
              return m > seenF;
            }).length;

            const gameUnread = (incomingInvites || []).filter((inv: any) => {
              const t =
                inv?.createdAt?.toMillis?.() ??
                inv?.updatedAt?.toMillis?.() ??
                0;
              return t > seenG;
            }).length;

            return friendUnread + gameUnread;
          }
        ),
        shareReplay({ bufferSize: 1, refCount: true })
      );
    });

    this.auth.user$.subscribe((user) => {
      if (!user) return;
      this.invitesIncoming$ = this.notifier.incomingGameInvites$();
      this.outgoingInvitesSub?.unsubscribe?.();
      this.outgoingInvitesSub = this.notifier
        .outgoingGameInvites$()
        .subscribe((list) => {
          const prev = this.previousOutgoing ?? [];
          const declinedNow = list.filter(
            (i) =>
              i.status === 'declined' &&
              !prev.some((p) => p.id === i.id && p.status === 'declined')
          );
          declinedNow.forEach((i) => {
            alert('Your game request was declined.');
          });
          this.previousOutgoing = list;
        });

      const friends$ = this.friend
        .myFriends$()
        .pipe(shareReplay({ bufferSize: 1, refCount: true }));
      this.friendCount$ = friends$.pipe(map((rows) => rows.length));

      this.friendsPreview$ = friends$.pipe(
        map((rows) => rows.map((r) => this.otherUidFrom(r.uids))),
        switchMap((uids) => {
          if (!uids.length) {
            return of(
              [] as Array<{
                uid: string;
                profile: UserProfile | null;
                online: boolean;
              }>
            );
          }
          const items$ = uids.map((uid) =>
            combineLatest([
              this.profile$(uid),
              this.presence.presence$(uid),
            ]).pipe(map(([profile, online]) => ({ uid, profile, online })))
          );
          return combineLatest(items$);
        }),
        // keep all; just sort online first
        map((list) => list.sort((a, b) => Number(b.online) - Number(a.online))),
        shareReplay({ bufferSize: 1, refCount: true })
      );

      // IMPORTANT: Build filtered list AFTER friendsPreview$ is defined
      this.filteredFriends$ = combineLatest([
        this.friendsPreview$,
        this.searchCtrl.valueChanges.pipe(startWith('')),
      ]).pipe(
        map(([friends, query]) => {
          const q = (query ?? '').trim().toLowerCase();

          // match by displayName OR email OR uid (so offline with profile null still matches by uid)
          const filtered = friends.filter((f) => {
            const name = (
              f.profile?.displayName ||
              f.profile?.email ||
              f.uid ||
              ''
            ).toLowerCase();
            return q === '' || name.includes(q);
          });

          // cap to 5 here (not earlier)
          const top5 = filtered.slice(0, 5);

          this.lastList = top5;
          if (this.activeIndex >= top5.length) this.activeIndex = 0;

          return top5;
        })
      );
    });

    this.recentGames$ = this.auth.user$.pipe(
      switchMap((user) =>
        user?.uid ? this.notifier.gamesForUser$(user.uid, 3) : of([])
      ),
      catchError((err) => {
        console.error('recentGames$', err);
        return of([]);
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  ngOnInit(): void {
    this.latencySvc.start(5000);
  }

  ngOnDestroy() {
    this.outgoingInvitesSub?.unsubscribe?.();
    this.latencySvc.stop();
  }

  setBotDifficulty(level: 'easy' | 'medium' | 'hard') {
    this.botDifficulty = level;
  }

  setBotMinutes(min: number) {
    this.botMinutes = min;
  }

  async startBotGame() {
    const uid = this.uid ?? this.route.snapshot.paramMap.get('uid');
    if (!uid) return;

    try {
      // 1) Create a Firestore "game" doc with bot metadata
      const gameId = await this.notifier.createBotGame({
        userUid: uid,
        difficulty: this.botDifficulty,
        minutes: this.botMinutes,
        increment: 0, // can add later
      });

      // 2) Create RTDB state
      await this.rtdbGame.create(gameId, uid, 'BOT', {
        minutes: this.botMinutes,
        increment: 0,
      });

      // 3) Go to the board
      this.router.navigate([`/${uid}/chess-board`], {
        queryParams: { game: gameId, bot: 1 },
      });
    } catch (e) {
      console.error(e);
      alert('Could not start bot game. Please try again.');
    }
  }

  private profileCache = new Map<string, Observable<UserProfile | null>>();

  profile$(uid: string): Observable<UserProfile | null> {
    if (!uid) return of(null);
    const cached = this.profileCache.get(uid);
    if (cached) return cached;

    const obs = this.userService
      .userProfile$(uid)
      .pipe(shareReplay({ bufferSize: 1, refCount: true }));
    this.profileCache.set(uid, obs);
    return obs;
  }

  otherUidFrom(uids: string[]): string {
    const me = this.uid ?? '';
    return uids.find((u) => u !== me) ?? '';
  }

  async toggleNotifications() {
    this.showNotifPanel = !this.showNotifPanel;
    if (this.showNotifPanel) {
      this.localSeenAt$.next(Date.now());
      await this.notifier.markAllNotificationsSeen();
    }
  }

  openRequestsFromNotif() {
    this.showNotifPanel = false;
    this.friendsModalTab = 'requests';
    this.showFriendsModal = true;
  }

  openDropdown() {
    if (this.selectedFriend) return;
    this.dropdownOpen = true;
  }

  closeDropdown() {
    this.dropdownOpen = false;
    this.activeIndex = 0;
  }

  selectFriend(f: {
    uid: string;
    profile: UserProfile | null;
    online: boolean;
  }) {
    if (!f.online) return;
    const display = f.profile?.displayName || f.profile?.email || f.uid;
    this.selectedFriend = {
      uid: f.uid,
      display,
      photoURL: f.profile?.photoURL ?? undefined,
    };
    this.selectedOpponentUid = f.uid;
    this.searchCtrl.setValue(''); // clear text
    this.closeDropdown(); // hide dropdown
  }

  clearSelection(ev?: MouseEvent) {
    ev?.stopPropagation?.();
    this.selectedFriend = null;
    this.selectedOpponentUid = null;
    this.searchCtrl.setValue(''); // reset input
    this.openDropdown(); // allow re-selecting someone else
  }

  onKeydown(e: KeyboardEvent) {
    if (!this.dropdownOpen) return;
    const len = this.lastList.length;
    if (!len) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activeIndex = (this.activeIndex + 1) % len;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activeIndex = (this.activeIndex - 1 + len) % len;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const f = this.lastList[this.activeIndex];
      if (f?.online) this.selectFriend(f);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.closeDropdown();
    }
  }

  openFriendsModal() {
    this.friendsModalTab = 'search';
    this.showFriendsModal = true;
  }

  closeFriendsModal() {
    this.showFriendsModal = false;
  }

  openSettings(): void {
    const uid = this.uid ?? this.route.snapshot.paramMap.get('uid');
    if (!uid) return;
    this.router.navigate(['/', uid, 'settings']);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  openProfile(): void {
    const uid = this.uid ?? this.route.snapshot.paramMap.get('uid');
    if (!uid) return;
    this.router.navigateByUrl(`/${uid}/profile-settings`);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    const target = ev.target as HTMLElement;
    const inBell = target.closest?.('#notif-bell-wrap');
    if (!inBell) this.showNotifPanel = false;
    const inFriendSearch =
      this.friendSearchRoot?.nativeElement?.contains(target);
    if (!inFriendSearch) this.closeDropdown();
  }

  async challenge(f: {
    uid: string;
    profile: UserProfile | null;
    online: boolean;
  }) {
    if (!f?.uid) return;
    if (!f.online) {
      alert('Your friend is offline right now.');
      return;
    }

    try {
      await this.notifier.sendGameInvite(f.uid);
      const uid = this.uid ?? this.route.snapshot.paramMap.get('uid');
      if (!uid) return;

      const inviteId = `${uid}_${f.uid}`;
      this.router.navigate([`/${uid}/chess-board`], {
        queryParams: { invite: inviteId, vs: f.uid },
      });
    } catch (e) {
      console.error(e);
      alert('Could not send the challenge. Please try again.');
    }
  }

  async onAcceptInvite(invite: { id: string; fromUid: string }) {
    try {
      const gameId = await this.notifier.acceptInviteAndCreateGame(invite.id);
      const uid = this.uid ?? this.route.snapshot.paramMap.get('uid');
      if (!uid) return;
      this.router.navigate([`/${uid}/chess-board`], {
        queryParams: { game: gameId },
      });
    } catch (e) {
      console.error(e);
    }
  }

  async onDeclineInvite(invite: { id: string; fromUid: string }) {
    try {
      await this.notifier.declineInvite(invite.id);
      // Notify sender: easiest is to rely on their outgoing stream to detect deletion and show a toast.
      // Optional: you can also write a one-off "gameDeclined" notification doc to their user doc if you already have a system.
      // For now, this action alone is enough.
    } catch (e) {
      console.error(e);
    }
  }

  opponentUid(g: GameDoc, myUid: string): string {
    const w = g.players?.white || '';
    const b = g.players?.black || '';
    return w === myUid ? b : w;
  }

  outcomeForUser(g: GameDoc, myUid: string): Outcome {
    const asWhite = g.players?.white === myUid;
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

  outcomeClasses(o: Outcome): { box: string; text: string } {
    if (o === 'W') return { box: 'bg-green-500/20', text: 'text-green-400' };
    if (o === 'L') return { box: 'bg-red-500/20', text: 'text-red-400' };
    return { box: 'bg-gray-500/20', text: 'text-gray-400' };
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

  openAllGamesModal() {
    this.showGamesModal = true;
  }
  closeAllGamesModal() {
    this.showGamesModal = false;
  }
}
