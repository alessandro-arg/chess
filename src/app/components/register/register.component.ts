import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../auth.service';
import { ToastService } from '../../toast.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  readonly form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    acceptTerms: [false, [Validators.requiredTrue]],
  });
  isSubmitting = false;
  showPassword = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private toastService: ToastService,
    private readonly router: Router
  ) {}

  register(): void {
    if (this.form.valid) {
      this.isSubmitting = true;

      const { username, email, password } = this.form.value;
      this.auth
        .register(username as string, email as string, password as string)
        .then(() => {
          this.toastService.success(
            'Account created successfully! Please sign in.',
            'Welcome',
            4000
          );
          this.router.navigateByUrl('/login');
        })
        .catch((error) => {
          const msg =
            this.auth.mapAuthError?.(error) ??
            'Registration failed. Please try again.';
          (this.toastService as any).error
            ? this.toastService.error(msg, '', 4000)
            : this.toastService.error(msg, 'Oops', 4000);
        })
        .finally(() => (this.isSubmitting = false));
    }
  }

  get username() {
    return this.form.get('username');
  }

  get email() {
    return this.form.get('email');
  }

  get password() {
    return this.form.get('password');
  }

  get acceptTerms() {
    return this.form.get('acceptTerms');
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }
}
