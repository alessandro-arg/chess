import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../auth.service';
import { FriendsModalComponent } from '../friends-modal/friends-modal.component';
import {
  combineLatest,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';
import { FriendService, Friendship } from '../../friend.service';
import { NotificationService } from '../../notification.service';
import { UserProfile, UserService } from '../../user.service';
import { PresenceService } from '../../presence.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FriendsModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
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

  constructor(
    private readonly auth: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly friend: FriendService,
    private readonly notifier: NotificationService,
    private readonly userService: UserService,
    private readonly presence: PresenceService
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
      const lastSeen$ = await this.notifier.lastSeenFriendReqAt$();

      this.unreadCount$ = combineLatest([this.incoming$, lastSeen$]).pipe(
        map(([incoming, lastSeen]) => {
          const last = lastSeen ?? 0;
          return incoming.filter((r) => {
            const m = (r as any)?.updatedAt?.toMillis?.() ?? 0;
            return m > last;
          }).length;
        })
      );
    });

    this.auth.user$.subscribe((user) => {
      if (!user) return;

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
      await this.notifier.markFriendRequestsSeen();
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

  openTestBoard(): void {
    const uid = this.uid ?? this.route.snapshot.paramMap.get('uid');
    if (!uid) return;
    this.router.navigate(['/', uid, 'chess-board']);
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
}
