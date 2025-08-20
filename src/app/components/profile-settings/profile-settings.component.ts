import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../../user.service';
import { AuthService } from '../../auth.service';
import {
  Storage,
  ref,
  uploadBytes,
  getDownloadURL,
} from '@angular/fire/storage';

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile-settings.component.html',
  styleUrl: './profile-settings.component.css',
})
export class ProfileSettingsComponent {
  uid = '';
  email: string | null = null;
  displayName: string | null = null;
  photoURL: string | null = null;
  isSaving = false;
  editingName = false;

  readonly form = this.fb.group({
    displayName: ['', [Validators.required, Validators.minLength(3)]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly userService: UserService,
    private readonly storage: Storage,
    private readonly auth: AuthService
  ) {
    this.uid = this.route.snapshot.paramMap.get('uid') || '';
    this.userService.userProfile$(this.uid).subscribe((profile) => {
      this.displayName = profile?.displayName ?? null;
      this.email = profile?.email ?? null;
      this.photoURL = profile?.photoURL ?? null;
      this.form.patchValue({ displayName: this.displayName ?? '' });
    });
  }

  async onFileSelected(evt: Event) {
    const input = evt.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const path = `users/${this.uid}/avatar`;
    const storageRef = ref(this.storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    await this.userService.upsertProfile(this.uid, { photoURL: url });
  }

  async save() {
    if (this.form.invalid) return;
    this.isSaving = true;
    const displayName = this.form.value.displayName as string;
    if (this.editingName && displayName && displayName !== this.displayName) {
      const taken = await this.userService.isDisplayNameTaken(
        displayName,
        this.uid
      );
      if (taken) {
        this.isSaving = false;
        try {
          window.dispatchEvent(
            new CustomEvent('app-toast', {
              detail: { kind: 'error', message: 'Username is already in use.' },
            })
          );
        } catch {}
        return;
      }
    }
    await this.userService.upsertProfile(this.uid, { displayName });
    this.isSaving = false;
    this.back();
  }

  back() {
    this.router.navigateByUrl(`/${this.uid}/dashboard`);
  }

  toggleEditName() {
    this.editingName = !this.editingName;
    if (this.editingName) {
      this.form.patchValue({ displayName: this.displayName ?? '' });
    }
  }
}
