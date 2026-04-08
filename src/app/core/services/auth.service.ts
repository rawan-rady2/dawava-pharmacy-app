import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { Logger } from '../utils/logger.util';

// ─── Role UUIDs ────────────────────────────────────────────────────────────────
const ROLE_ADMIN      = 'a4f25d0a-6a19-4f96-91cb-8ea8847f7340';
const ROLE_PHARMACIST = '';
const ROLE_MANAGER    = '';

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
          // SECURITY: access token → sessionStorage (clears when tab closes)
          // SECURITY: refresh token → localStorage (persists for remember me)
          // NEVER log token values — only log boolean presence
          sessionStorage.setItem(this.TOKEN_KEY, res.access_token);
          localStorage.setItem(this.REFRESH_KEY, res.refresh_token);

          const roleId = res?.scope?.roles?.[0] || null;
          if (roleId) {
            sessionStorage.setItem(this.ROLE_KEY, roleId);
          }

          // SECURITY: only log non-sensitive confirmation — never log token or response body
          Logger.log('[AuthService] Login completed');
        }),
        catchError((err) => {
          Logger.warn('[AuthService] Login request failed — status:', err.status);
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
          sessionStorage.setItem(this.ROLE_KEY, res.role);
          Logger.log('[AuthService] Permissions loaded');
        }),
        catchError((err) => {
          Logger.warn('[AuthService] Permissions request failed — status:', err.status);

          const savedRole = this.getRole();
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
          sessionStorage.setItem(this.TOKEN_KEY, res.access_token);
          localStorage.setItem(this.REFRESH_KEY, res.refresh_token);
          Logger.log('[AuthService] Token refreshed');
        }),
        catchError((err) => {
          Logger.warn('[AuthService] Token refresh failed — status:', err.status);
          this.clearAllStorage();
          this.router.navigate(['/login']);
          return throwError(() => new Error('Session expired. Please log in again.'));
        })
      );
  }

  // ─── Combined Flow ───────────────────────────────────────────────────────────

  loginAndRedirect(payload: LoginRequest): Observable<PermissionsResponse> {
    return this.login(payload).pipe(
      switchMap((loginRes) => {
        const roleId = loginRes?.scope?.roles?.[0] || null;

        if (roleId) {
          Logger.log('[AuthService] Role resolved from login response');
          return [{ role: roleId, permissions: [] }];
        }

        Logger.log('[AuthService] Fetching permissions from server');
        return this.getPermissions();
      })
    );
  }

  // ─── Token Expiry Check ──────────────────────────────────────────────────────

  private isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return true;

      // Pad base64 string to valid length
      const padded = payloadBase64.padEnd(
        payloadBase64.length + (4 - (payloadBase64.length % 4)) % 4,
        '='
      );
      const payload = JSON.parse(atob(padded));

      // exp is in seconds — 60 second buffer before actual expiry
      const expiryMs  = payload.exp * 1000;
      const bufferMs  = 60 * 1000;

      return Date.now() > (expiryMs - bufferMs);
    } catch {
      // Cannot decode token — treat as expired
      return true;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  getToken(): string | null {
    return (
      sessionStorage.getItem(this.TOKEN_KEY) ||
      localStorage.getItem(this.TOKEN_KEY)
    );
  }

  getRole(): string | null {
    return (
      sessionStorage.getItem(this.ROLE_KEY) ||
      localStorage.getItem(this.ROLE_KEY)
    );
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_KEY);
  }

  isLoggedIn(): boolean {
    if (!this.getToken()) return false;

    if (this.isTokenExpired()) {
      Logger.warn('[AuthService] Token expired — clearing session');
      this.clearAllStorage();
      return false;
    }

    return true;
  }

  logout(): void {
    const refreshToken = localStorage.getItem(this.REFRESH_KEY);

    if (refreshToken) {
      this.http
        .post(
          `${this.API_BASE}/api/auth/logout`,
          { refresh_token: refreshToken },
          { observe: 'response' }
        )
        .subscribe({
          next: (res) => {
            Logger.log('[AuthService] Server logout completed — status:', res.status);
          },
          error: (err) => {
            Logger.warn('[AuthService] Server logout request failed — status:', err.status);
          },
        });
    }

    this.clearAllStorage();
    this.router.navigate(['/login']);
  }

  redirectByRole(role: string): void {
    Logger.log('[AuthService] Redirecting by role');

    if (role === ROLE_ADMIN) {
      this.router.navigate(['/admin-dashboard']);
    } else {
      this.router.navigate(['/user-dashboard']);
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private clearAllStorage(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.ROLE_KEY);
    sessionStorage.removeItem(this.REFRESH_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.ROLE_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
  }

  private extractErrorMessage(err: any): string {
    // SECURITY: generic messages only — never expose HTTP status codes
    // or internal error details to the user interface

    if (err.status === 0) {
      return 'Unable to connect. Please check your internet connection.';
    }

    if (err.status === 401 || err.status === 403) {
      // SECURITY: do not distinguish between wrong password and unauthorized
      // This prevents user enumeration attacks
      return 'Sign in failed. Please check your email and password.';
    }

    if (err.status === 429) {
      return 'Too many attempts. Please wait a few minutes before trying again.';
    }

    if (err.status >= 500) {
      return 'A system error occurred. Please try again or contact IT support.';
    }

    return 'Sign in failed. Please try again.';
  }
}