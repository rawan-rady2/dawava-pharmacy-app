import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent
      ),
  },
  {
    path: 'admin-dashboard',
    loadComponent: () =>
      import('./features/admin-dashboard/admin-dashboard.component').then(
        (m) => m.AdminDashboardComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'user-dashboard',
    loadComponent: () =>
      import('./features/user-dashboard/user-dashboard.component').then(
        (m) => m.UserDashboardComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];

