import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../auth.service';
import { UserProfile, UserService } from '../../user.service';
import { Observable, of } from 'rxjs';
import { filter, map, startWith, switchMap, take } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';

export type SettingsView =
  | 'main'
  | 'profile'
  | 'privacy'
  | 'impressum'
  | 'support';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit {
  currentView: SettingsView = 'main';
  userProfile$: Observable<UserProfile | null> = of(null);
  inChild = false;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly userService: UserService,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const routeUid = this.route.snapshot.paramMap.get('uid');

    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        startWith(null)
      )
      .subscribe(() => (this.inChild = !!this.route.firstChild));

    this.userProfile$ = this.auth.user$.pipe(
      switchMap((user) => {
        if (!user) {
          this.router.navigateByUrl('/login');
          return of(null);
        }

        if (routeUid && routeUid !== user.uid) {
          this.router.navigate(['/', user.uid, 'settings']);
          return of(null);
        }

        return this.userService.userProfile$(user.uid).pipe(
          map((profile) => {
            if (profile) return profile;
            return {
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
              photoURL: user.photoURL,
              createdAt: user.metadata?.creationTime
                ? new Date(user.metadata.creationTime)
                : null,
            };
          })
        );
      })
    );
  }

  openProfileSettings(): void {
    const uid = this.route.snapshot.paramMap.get('uid');
    if (!uid) return;
    this.router.navigate(['/', uid, 'settings', 'profile-settings']);
  }

  openSupport(): void {
    const uid = this.route.snapshot.paramMap.get('uid');
    if (!uid) return;
    this.router.navigate(['/', uid, 'settings', 'support']);
  }

  openPrivacyPolicy() {
    const uid = this.route.snapshot.paramMap.get('uid');
    if (!uid) return;
    this.router.navigate(['/', uid, 'settings', 'privacy-policy']);
  }

  openImpressum() {
    const uid = this.route.snapshot.paramMap.get('uid');
    if (!uid) return;
    this.router.navigate(['/', uid, 'settings', 'impressum']);
  }

  navigateToView(view: SettingsView): void {
    this.currentView = view;
  }

  goBackToDashboard(): void {
    const uidFromUrl = this.route.snapshot.paramMap.get('uid');
    if (uidFromUrl) {
      this.router.navigate(['/', uidFromUrl, 'dashboard']);
    } else {
      this.auth.user$
        .pipe(map((u) => u?.uid))
        .subscribe((uid) => {
          if (uid) this.router.navigate(['/', uid, 'dashboard']);
          else this.router.navigateByUrl('/login');
        })
        .unsubscribe();
    }
  }

  async onLogout(): Promise<void> {
    try {
      await this.auth.logout();
      this.router.navigateByUrl('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  getDisplayName(profile: UserProfile | null): string {
    return profile?.displayName || profile?.email || 'User';
  }

  getAvatarUrl(profile: UserProfile | null): string | null {
    return profile?.photoURL || null;
  }

  getViewTitle(): string {
    switch (this.currentView) {
      case 'profile':
        return 'Profile Settings';
      case 'privacy':
        return 'Privacy Policy';
      case 'impressum':
        return 'Impressum';
      case 'support':
        return 'Support';
      default:
        return 'Settings';
    }
  }
}
