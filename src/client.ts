import axios, { AxiosInstance, AxiosError } from 'axios';
import { getConfig } from './config.js';

// In one-shot mode a fatal API error prints and exits the process. The shell
// (repl) switches this off so a fatal error rejects normally and the session
// survives instead of being torn down.
let exitOnFatal = true;
export function setReplMode(): void {
  exitOnFatal = false;
}

function createClient(): AxiosInstance {
  const config = getConfig();
  const baseURL = config.apiUrl || 'https://nexusai.run';

  const instance = axios.create({
    baseURL,
    timeout: 30000,
  });

  instance.interceptors.request.use((req) => {
    const cfg = getConfig();
    if (cfg.token) {
      req.headers = req.headers || {};
      req.headers['Authorization'] = `Bearer ${cfg.token}`;
    }
    return req;
  });

  const fatal = (message: string, error: AxiosError): Promise<never> => {
    if (exitOnFatal) {
      console.error(message);
      process.exit(1);
    }
    return Promise.reject(new Error(message));
  };

  instance.interceptors.response.use(
    (res) => res,
    (error: AxiosError) => {
      if (!error.response) {
        return fatal(`Cannot reach NEXUS AI API at ${baseURL}.`, error);
      }

      const status = error.response.status;
      const data = error.response.data as any;

      if (status === 401) {
        return fatal("Session expired. Run 'nexus auth login'", error);
      }

      if (status === 403) {
        return fatal(data?.message || data?.error || 'Access denied.', error);
      }

      return Promise.reject(error);
    }
  );

  return instance;
}

export const client = createClient();

/** Unwrap { success, data } envelope if present, otherwise return as-is. */
export function unwrap(responseData: any): any {
  if (responseData && typeof responseData === 'object' && 'data' in responseData) {
    return responseData.data;
  }
  return responseData;
}

export function apiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as any;
    return data?.message || data?.error || error.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
