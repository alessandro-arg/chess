import {
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
  computed,
  effect,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FriendService, Friendship } from '../../friend.service';
import { UserService, UserProfile } from '../../user.service';
import { FormsModule } from '@angular/forms';
import { Auth } from '@angular/fire/auth';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-friends-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './friends-modal.component.html',
  styleUrl: './friends-modal.component.css',
})
export class FriendsModalComponent {
  @Input() isOpen = false;
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

  myFriends$ = this.friend.myFriends$();
  incoming$ = this.friend.incomingPending$();
  outgoing$ = this.friend.outgoingPending$();

  constructor(
    private friend: FriendService,
    private user: UserService,
    private auth: Auth
  ) {}

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

    // Require at least 3 chars
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
