import { AxiosInstance } from 'axios';
export declare const client: AxiosInstance;
/** Unwrap { success, data } envelope if present, otherwise return as-is. */
export declare function unwrap(responseData: any): any;
export declare function apiError(error: unknown): string;
//# sourceMappingURL=client.d.ts.map