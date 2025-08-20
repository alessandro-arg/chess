import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  displayName: string | null = null;
  uid: string | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    this.auth.user$.subscribe((user) => {
      this.uid = user?.uid ?? null;
      this.displayName = user?.displayName ?? user?.email ?? null;
    });
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
}
