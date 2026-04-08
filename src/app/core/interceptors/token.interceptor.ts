import { HttpInterceptorFn } from '@angular/common/http';

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  // Read token from sessionStorage first, fallback to localStorage
  const token =
    sessionStorage.getItem('dawava_token') ||
    localStorage.getItem('dawava_token');

  if (token) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
    return next(authReq);
  }

  return next(req);
};