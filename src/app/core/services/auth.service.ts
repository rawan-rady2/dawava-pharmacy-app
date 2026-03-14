import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { Router } from '@angular/router';

// ─── Role UUIDs ────────────────────────────────────────────────────────────────
const ROLE_ADMIN      = 'a4f25d0a-6a19-4f96-91cb-8ea8847f7340';
const ROLE_PHARMACIST = ''; // ← paste when backend confirms
const ROLE_MANAGER    = ''; // ← paste when backend confirms

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface LoginRequest {
  identifier: string;
  password: string;
  branch_id: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
  scope: {
    branch_id: string | null;
    roles: string[];
  };
  available_scopes: any[];
}

export interface PermissionsResponse {
  role: string;
  permissions: string[];
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly API_BASE    = '';
  private readonly TOKEN_KEY   = 'dawava_token';
  private readonly ROLE_KEY    = 'dawava_role';
  private readonly REFRESH_KEY = 'dawava_refresh_token';

  constructor(private http: HttpClient, private router: Router) {}

  // ─── Login ──────────────────────────────────────────────────────────────────

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.API_BASE}/api/auth/login`, payload)
      .pipe(
        tap((res) => {
          localStorage.setItem(this.TOKEN_KEY, res.access_token);
          localStorage.setItem(this.REFRESH_KEY, res.refresh_token);

          const roleId = res?.scope?.roles?.[0] || null;
          if (roleId) {
            localStorage.setItem(this.ROLE_KEY, roleId);
          }

          console.log('[AuthService] ✅ Login success');
          console.log('[AuthService] access_token saved:', !!res.access_token);
          console.log('[AuthService] role UUID:', roleId);
        }),
        catchError((err) => {
          console.error('[AuthService] ❌ Login failed:', err.status, err.error);
          return throwError(() => new Error(this.extractErrorMessage(err)));
        })
      );
  }

  // ─── Permissions ────────────────────────────────────────────────────────────

  getPermissions(): Observable<PermissionsResponse> {
    return this.http
      .get<PermissionsResponse>(`${this.API_BASE}/api/auth/me/permissions`)
      .pipe(
        tap((res) => {
          localStorage.setItem(this.ROLE_KEY, res.role);
          console.log('[AuthService] ✅ Permissions loaded — role:', res.role);
        }),
        catchError((err) => {
          console.error('[AuthService] ❌ Permissions failed:', err.status);
          const savedRole = localStorage.getItem(this.ROLE_KEY);
          if (savedRole) {
            return [{ role: savedRole, permissions: [] }];
          }
          return throwError(() => new Error(this.extractErrorMessage(err)));
        })
      );
  }

  // ─── Token Refresh ───────────────────────────────────────────────────────────

  refreshToken(): Observable<RefreshResponse> {
    const refreshToken = localStorage.getItem(this.REFRESH_KEY);

    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available.'));
    }

    return this.http
      .post<RefreshResponse>(`${this.API_BASE}/api/auth/refresh`, {
        refresh_token: refreshToken,
      })
      .pipe(
        tap((res) => {
          localStorage.setItem(this.TOKEN_KEY, res.access_token);
          localStorage.setItem(this.REFRESH_KEY, res.refresh_token);
          console.log('[AuthService] ✅ Token refreshed');
        }),
        catchError((err) => {
          console.error('[AuthService] ❌ Token refresh failed:', err.status);
          this.clearLocalStorage();
          this.router.navigate(['/login']);
          return throwError(() => new Error('Session expired. Please log in again.'));
        })
      );
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────
  //
  // Two-step logout:
  // Step 1 — Tell the backend to invalidate the refresh token on the server
  // Step 2 — Clear localStorage and redirect to login
  //
  // Even if the server call fails, the user is still logged out locally.
  // This is intentional — never block logout because of a network error.

 logout(): void {
  const refreshToken = localStorage.getItem(this.REFRESH_KEY);

  if (refreshToken) {
    this.http
      .post(
        `${this.API_BASE}/api/auth/logout`,
        { refresh_token: refreshToken },
        // Tell Angular not to parse the response body
        // because 204 has no body — prevents any parsing errors
        { observe: 'response' }
      )
      .subscribe({
        next: (res) => {
          console.log(
            '[AuthService] ✅ Server logout successful — status:',
            res.status  // will print 204
          );
        },
        error: (err) => {
          console.warn(
            '[AuthService] ⚠️ Server logout failed:',
            err.status,
            '— logging out locally anyway'
          );
        },
      });
  }

  // Always clear and redirect — never wait for server response
  this.clearLocalStorage();
  this.router.navigate(['/login']);
}

  // ─── Combined Flow ───────────────────────────────────────────────────────────

  loginAndRedirect(payload: LoginRequest): Observable<PermissionsResponse> {
    return this.login(payload).pipe(
      switchMap((loginRes) => {
        const roleId = loginRes?.scope?.roles?.[0] || null;

        if (roleId) {
          console.log('[AuthService] ✅ Role from login scope:', roleId);
          return [{ role: roleId, permissions: [] }];
        }

        console.warn('[AuthService] No role in login response — calling permissions...');
        return this.getPermissions();
      })
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRole(): string | null {
    return localStorage.getItem(this.ROLE_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  redirectByRole(role: string): void {
    console.log('[AuthService] redirectByRole called with:', role);

    if (role === ROLE_ADMIN) {
      this.router.navigate(['/admin-dashboard']);
    } else {
      this.router.navigate(['/user-dashboard']);
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private clearLocalStorage(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.ROLE_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
  }

  private extractErrorMessage(err: any): string {
    if (err.status === 0)   return 'Cannot reach the server. Check your connection.';
    if (err.status === 401) return 'Incorrect email or password.';
    if (err.status === 403) return 'Access denied. You do not have permission.';
    if (err.status === 404) return 'API endpoint not found.';
    if (err.status === 422) return 'Invalid data submitted. Please check your inputs.';
    if (err.status === 500) return 'Server error. Please contact your administrator.';
    return (
      err.error?.message ||
      err.error?.error   ||
      `Request failed (HTTP ${err.status}). Please try again.`
    );
  }
}