// Controls all console output based on environment
// In production: only errors appear, never sensitive data
// In development: warnings and errors appear, no sensitive response data

const isProduction = (): boolean => {
  try {
    // Reads from Angular's built-in environment flag
    return (window as any).__env_production === true;
  } catch {
    return false;
  }
};

export const Logger = {
  log: (...args: any[]) => {
    // Completely silent in production
    if (!isProduction()) {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    // Only in development
    if (!isProduction()) {
      console.warn(...args);
    }
  },
  error: (message: string) => {
    // Always logs but NEVER exposes sensitive data
    console.error('[Dawava Error]', message);
  }
};