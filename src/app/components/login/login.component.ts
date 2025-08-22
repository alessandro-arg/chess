import { Component, NgZone } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth.service';
import { take } from 'rxjs/operators';
import { ToastService } from '../../toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });
  isSubmitting = false;
  showPassword = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly zone: NgZone,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.auth.handleRedirectResult().then((user) => {
        if (user) {
          try {
            const suppress =
              sessionStorage.getItem('suppressLoginRedirectOnce') === '1';
            if (suppress) {
              sessionStorage.removeItem('suppressLoginRedirectOnce');
              return;
            }
          } catch {}
          this.zone.run(() =>
            this.router.navigateByUrl(`/${user.uid}/dashboard`)
          );
        }
      });
      this.auth.user$.pipe(take(1)).subscribe((user) => {
        if (user) {
          try {
            const suppress =
              sessionStorage.getItem('suppressLoginRedirectOnce') === '1';
            if (suppress) {
              sessionStorage.removeItem('suppressLoginRedirectOnce');
              return;
            }
          } catch {}
          this.zone.run(() =>
            this.router.navigateByUrl(`/${user.uid}/dashboard`)
          );
        }
      });
    }
  }

  submit(): void {
    if (this.form.valid) {
      this.isSubmitting = true;

      const { email, password } = this.form.value;
      this.auth
        .loginWithEmail(email as string, password as string)
        .then((user) => {
          this.toastService.success(
            'Login successful! Welcome back to the game.',
            'Authentication Success',
            4000
          );
          this.zone.run(() =>
            this.router.navigateByUrl(`/${user.uid}/dashboard`)
          );
        })
        .catch((error) => {
          const msg = this.auth.mapAuthError(error);
          this.toastService.error(msg, 'Login Failed', 4000);
        })
        .finally(() => (this.isSubmitting = false));
    }
  }

  async google(): Promise<void> {
    this.isSubmitting = true;
    try {
      const user = await this.auth.loginWithGooglePopup();
      if (user) {
        this.toastService.success(
          'Successfully logged in with Google!',
          '',
          4000
        );
        this.zone.run(() =>
          this.router.navigateByUrl(`/${user.uid}/dashboard`)
        );
      } else {
        this.toastService.info('Google sign-in was canceled.', '', 4000);
      }
    } finally {
      this.isSubmitting = false;
    }
  }

  get email() {
    return this.form.get('email');
  }

  get password() {
    return this.form.get('password');
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onForgotPassword(): void {
    console.log('Forgot password clicked');
  }

  navigateToRegister(): void {
    this.router.navigate(['/register']);
  }
}
