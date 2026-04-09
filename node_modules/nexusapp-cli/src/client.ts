import axios, { AxiosInstance, AxiosError } from 'axios';
import { getConfig } from './config.js';

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

  instance.interceptors.response.use(
    (res) => res,
    (error: AxiosError) => {
      if (!error.response) {
        const url = baseURL;
        console.error(`Cannot reach NEXUS AI API at ${url}.`);
        process.exit(1);
      }

      const status = error.response.status;
      const data = error.response.data as any;

      if (status === 401) {
        console.error("Session expired. Run 'nexus auth login'");
        process.exit(1);
      }

      if (status === 403) {
        console.error(data?.message || data?.error || 'Access denied.');
        process.exit(1);
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
