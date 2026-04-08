import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding: 40px; font-family: Inter, sans-serif;">
      <h1>Admin Dashboard</h1>
      <p>Welcome, Admin. You are logged in.</p>
      <button
        (click)="logout()"
        style="padding: 10px 20px; background: #14b8a5; color: white;
               border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
        Logout
      </button>
    </div>
  `,
})
export class AdminDashboardComponent implements OnInit {
  private authService = inject(AuthService);

  ngOnInit(): void {
    // Do NOT call redirectByRole or isLoggedIn here
    // The authGuard already handles protection for this route
    console.log('[AdminDashboard] Loaded successfully');
  }

  logout(): void {
    this.authService.logout();
  }
}
