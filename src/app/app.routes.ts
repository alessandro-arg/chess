import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
// import { DashboardComponent } from './dashboard.component';
// import { ProfileSettingsComponent } from './profile-settings.component';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  // {
  //   path: ':uid/dashboard',
  //   component: DashboardComponent,
  //   canActivate: [authGuard],
  // },
  // {
  //   path: ':uid/profile-settings',
  //   component: ProfileSettingsComponent,
  //   canActivate: [authGuard],
  // },
  { path: '**', redirectTo: 'login' },
];
