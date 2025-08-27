import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../auth.service';
import { FriendsModalComponent } from '../friends-modal/friends-modal.component';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';
import { FriendService, Friendship } from '../../friend.service';
import { GameInvite, NotificationService } from '../../notification.service';
import { UserProfile, UserService } from '../../user.service';
import { PresenceService } from '../../presence.service';
import { GameRtdbService } from '../../game-rtdb.service';
import { LatencyService } from '../../latency.service';
import { LiveClockComponent } from '../live-clock/live-clock.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FriendsModalComponent, LiveClockComponent],
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

  friendsPreview$?: Observable<
    Array<{ uid: string; profile: UserProfile | null; online: boolean }>
  >;
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
          if (!uids.length)
            return of(
              [] as Array<{
                uid: string;
                profile: UserProfile | null;
                online: boolean;
              }>
            );
          const items$ = uids.map((uid) =>
            combineLatest([
              this.profile$(uid),
              this.presence.presence$(uid),
            ]).pipe(map(([profile, online]) => ({ uid, profile, online })))
          );
          return combineLatest(items$);
        }),
        map((list) =>
          list.sort((a, b) => Number(b.online) - Number(a.online)).slice(0, 5)
        ),
        shareReplay({ bufferSize: 1, refCount: true })
      );
    });
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
}
