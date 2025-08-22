import {
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { firstValueFrom, Observable, of } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FriendService, Friendship } from '../../friend.service';
import { UserService, UserProfile } from '../../user.service';
import { FormsModule } from '@angular/forms';
import { Auth, authState } from '@angular/fire/auth';
import { map, shareReplay, take } from 'rxjs/operators';

@Component({
  selector: 'app-friends-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './friends-modal.component.html',
  styleUrl: './friends-modal.component.css',
})
export class FriendsModalComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() initialTab: 'search' | 'requests' | 'friends' = 'search';
  @Output() close = new EventEmitter<void>();

  activeTab = signal<'search' | 'requests' | 'friends'>('search');
  query = signal('');
  searching = signal(false);
  results = signal<
    Array<
      UserProfile & {
        status: 'none' | 'friends' | 'pending-in' | 'pending-out';
      }
    >
  >([]);

  myFriends$: Observable<Friendship[]> = of([]);
  incoming$: Observable<Friendship[]> = of([]);
  outgoing$: Observable<Friendship[]> = of([]);

  private profileCache = new Map<string, Observable<UserProfile | null>>();

  constructor(
    private friend: FriendService,
    private user: UserService,
    private auth: Auth
  ) {}

  ngOnInit() {
    authState(this.auth)
      .pipe(take(1))
      .subscribe((u) => {
        if (!u) return;
        this.myFriends$ = this.friend.myFriends$();
        this.incoming$ = this.friend.incomingPending$();
        this.outgoing$ = this.friend.outgoingPending$();
      });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen'] && this.isOpen) {
      this.activeTab.set(this.initialTab || 'search');
    }
    if (changes['initialTab'] && this.isOpen) {
      this.activeTab.set(this.initialTab);
    }
  }

  profile$(uid: string): Observable<UserProfile | null> {
    if (!uid) return of(null);
    const cached = this.profileCache.get(uid);
    if (cached) return cached;

    const obs = this.user
      .userProfile$(uid)
      .pipe(shareReplay({ bufferSize: 1, refCount: true }));
    this.profileCache.set(uid, obs);
    return obs;
  }

  name$(uid: string): Observable<string> {
    return this.profile$(uid).pipe(
      map((p) => p?.displayName || p?.email || uid)
    );
  }

  meUid(): string {
    return this.auth.currentUser?.uid ?? '';
  }

  otherUid(uids: ReadonlyArray<string>): string {
    const me = this.meUid();
    return uids.find((u) => u !== me) ?? '';
  }

  acceptByFriendship(uids: ReadonlyArray<string>) {
    const other = this.otherUid(uids);
    if (other) this.accept(other);
  }

  declineByFriendship(uids: ReadonlyArray<string>) {
    const other = this.otherUid(uids);
    if (other) this.decline(other);
  }

  trackById(_: number, item: { id?: string }) {
    return item?.id ?? _;
  }

  async runSearch() {
    const term = this.query().trim().toLowerCase();
    if (term.length < 3) {
      this.results.set([]);
      return;
    }

    this.searching.set(true);
    try {
      const raw = await this.friend.searchUsers(term);
      const me = this.auth.currentUser?.uid ?? '';

      const decorated = await Promise.all(
        raw.slice(0, 3).map(async (u) => {
          const fs = await firstValueFrom(this.friend.friendship$(u.uid));
          let status: 'none' | 'friends' | 'pending-in' | 'pending-out' =
            'none';
          if (fs) {
            if (fs.status === 'accepted') status = 'friends';
            else if (fs.status === 'pending')
              status = fs.requestedBy === me ? 'pending-out' : 'pending-in';
          }
          return { ...u, status };
        })
      );

      this.results.set(decorated);
    } finally {
      this.searching.set(false);
    }
  }

  async addFriend(uid: string) {
    await this.friend.sendRequest(uid);
    await this.runSearch();
  }

  async accept(uid: string) {
    await this.friend.accept(uid);
    await this.runSearch();
  }

  async decline(uid: string) {
    await this.friend.decline(uid);
    await this.runSearch();
  }
}
