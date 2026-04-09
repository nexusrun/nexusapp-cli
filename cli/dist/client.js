"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = void 0;
exports.unwrap = unwrap;
exports.apiError = apiError;
const axios_1 = __importDefault(require("axios"));
const config_js_1 = require("./config.js");
function createClient() {
    const config = (0, config_js_1.getConfig)();
    const baseURL = config.apiUrl || 'https://nexusai.run';
    const instance = axios_1.default.create({
        baseURL,
        timeout: 30000,
    });
    instance.interceptors.request.use((req) => {
        const cfg = (0, config_js_1.getConfig)();
        if (cfg.token) {
            req.headers = req.headers || {};
            req.headers['Authorization'] = `Bearer ${cfg.token}`;
        }
        return req;
    });
    instance.interceptors.response.use((res) => res, (error) => {
        if (!error.response) {
            const url = baseURL;
            console.error(`Cannot reach NEXUS AI API at ${url}.`);
            process.exit(1);
        }
        const status = error.response.status;
        const data = error.response.data;
        if (status === 401) {
            console.error("Session expired. Run 'nexus auth login'");
            process.exit(1);
        }
        if (status === 403) {
            console.error(data?.message || data?.error || 'Access denied.');
            process.exit(1);
        }
        return Promise.reject(error);
    });
    return instance;
}
exports.client = createClient();
/** Unwrap { success, data } envelope if present, otherwise return as-is. */
function unwrap(responseData) {
    if (responseData && typeof responseData === 'object' && 'data' in responseData) {
        return responseData.data;
    }
    return responseData;
}
function apiError(error) {
    if (axios_1.default.isAxiosError(error)) {
        const data = error.response?.data;
        return data?.message || data?.error || error.message;
    }
    if (error instanceof Error)
        return error.message;
    return String(error);
}
//# sourceMappingURL=client.js.map