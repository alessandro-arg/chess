import { Component } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  loginForm = this.fb.group({
    usernameOrEmail: ['', [Validators.required]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });
  showPassword = false;
  isLoading = false;
  loginError = '';

  constructor(private fb: FormBuilder, private router: Router) {}

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onLogin(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.loginError = '';

      const formValue = this.loginForm.value;

      // Simulate API call
      setTimeout(() => {
        this.isLoading = false;
        // Handle login logic here
        console.log('Login attempt:', formValue);
        // this.authService.login(formValue).subscribe(...)
      }, 2000);
    }
  }

  onForgotPassword(): void {
    // Handle forgot password logic
    console.log('Forgot password clicked');
  }

  onGoogleLogin(): void {
    // Handle Google OAuth login
    console.log('Google login clicked');
  }

  onDiscordLogin(): void {
    // Handle Discord OAuth login
    console.log('Discord login clicked');
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }
}
