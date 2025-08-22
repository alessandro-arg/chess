import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../auth.service';
import { UserProfile, UserService } from '../../../user.service';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './support.component.html',
  styleUrl: './support.component.css',
})
export class SupportComponent implements OnInit {
  profile$: Observable<UserProfile | null> = of(null);

  uid: string | null = null;
  displayName = '';
  email = '';
  photoURL: string | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly userService: UserService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    const urlUid =
      this.route.snapshot.paramMap.get('uid') ??
      this.route.parent?.snapshot.paramMap.get('uid') ??
      null;

    this.profile$ = this.auth.user$.pipe(
      switchMap((user) => {
        if (!user) {
          this.router.navigateByUrl('/login');
          return of(null);
        }

        if (urlUid && urlUid !== user.uid) {
          this.router.navigate(['/', user.uid, 'settings', 'support']);
          return of(null);
        }

        this.uid = user.uid;

        return this.userService.userProfile$(user.uid).pipe(
          map((p) => {
            const profile: UserProfile =
              p ??
              ({
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                createdAt: user.metadata?.creationTime
                  ? new Date(user.metadata.creationTime)
                  : null,
              } as UserProfile);
            this.displayName = profile.displayName ?? '';
            this.email = profile.email ?? '';
            this.photoURL = profile.photoURL ?? null;

            return profile;
          })
        );
      })
    );
  }

  backToSettings(): void {
    const uid =
      this.route.snapshot.paramMap.get('uid') ??
      this.route.parent?.snapshot.paramMap.get('uid');
    if (uid) this.router.navigate(['/', uid, 'settings']);
  }
}
