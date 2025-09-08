import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../auth.service';
import { UserProfile, UserService } from '../../../user.service';
import { Observable, of, firstValueFrom } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { Storage } from '@angular/fire/storage';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile as fbUpdateProfile } from 'firebase/auth';

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-settings.component.html',
  styleUrl: './profile-settings.component.css',
})
export class ProfileSettingsComponent implements OnInit {
  profile$: Observable<UserProfile | null> = of(null);

  uid: string | null = null;
  displayName = '';
  email = '';
  photoURL: string | null = null;

  saving = false;
  uploading = false;

  private from: 'settings' | 'dashboard' | undefined;
  private inSettingsPath = false;

  constructor(
    private readonly auth: AuthService,
    private readonly userService: UserService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly storage: Storage,
    private readonly location: Location
  ) {
    const nav = this.router.getCurrentNavigation();
    this.from =
      (nav?.extras?.state as any)?.from ??
      (window.history?.state?.from as 'settings' | 'dashboard' | undefined);

    // also infer from current URL (helps on hard refresh / deep links)
    this.inSettingsPath = this.router.url.includes('/settings/');
  }

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
          this.router.navigate(['/', user.uid, 'settings', 'profile-settings']);
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

  async onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.uid) return;

    this.uploading = true;
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const storageRef = ref(
        this.storage,
        `avatars/${this.uid}.${Date.now()}.${ext}`
      );
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      this.photoURL = url; // preview immediately
    } finally {
      this.uploading = false;
    }
  }

  async save(): Promise<void> {
    if (!this.uid) return;
    this.saving = true;

    try {
      // Update Firebase Auth user (displayName & photoURL)
      const authUser = await firstValueFrom(this.auth.user$);
      if (authUser) {
        await fbUpdateProfile(authUser, {
          displayName: this.displayName || null,
          photoURL: this.photoURL || undefined,
        } as any);
      }

      // Update Firestore profile + searchKeywords via your service
      await this.userService.upsertProfile(this.uid, {
        uid: this.uid,
        displayName: this.displayName || null,
        email: this.email || null, // email is read-only here but pass it for keywords
        photoURL: this.photoURL || null,
      });

      // Optional: go back to settings after save
      this.router.navigate(['/', this.uid, 'settings']);
    } finally {
      this.saving = false;
    }
  }

  backToSettings(): void {
    const uid =
      this.route.snapshot.paramMap.get('uid') ??
      this.route.parent?.snapshot.paramMap.get('uid');

    // 1) If we *know* the origin, go there explicitly
    if (this.from === 'settings' && uid) {
      this.router.navigate(['/', uid, 'settings']);
      return;
    }
    if (this.from === 'dashboard' && uid) {
      this.router.navigate(['/', uid, 'dashboard']);
      return;
    }

    // 2) If URL shows we’re under /settings/, prefer going back to settings
    if (this.inSettingsPath && uid) {
      this.router.navigate(['/', uid, 'settings']);
      return;
    }

    // 3) If browser history exists, use it (covers external links, etc.)
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    // 4) Final sensible default
    if (uid) {
      this.router.navigate(['/', uid, 'dashboard']);
    }
  }
}
