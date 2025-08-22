import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { SettingsComponent } from './components/settings/settings.component';
import { authGuard } from './auth.guard';
import { ProfileSettingsComponent } from './components/settings/profile-settings/profile-settings.component';
import { SupportComponent } from './components/settings/support/support.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  {
    path: ':uid/dashboard',
    component: DashboardComponent,
    // canActivate: [authGuard],
  },
  { path: ':uid/profile-settings', component: ProfileSettingsComponent },
  { path: ':uid/support', component: SupportComponent },
  {
    path: ':uid/settings',
    component: SettingsComponent,
    // canActivate: [AuthGuard],
    children: [
      { path: 'profile-settings', component: ProfileSettingsComponent },
      { path: 'support', component: SupportComponent },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
