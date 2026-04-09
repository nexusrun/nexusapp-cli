"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
exports.saveConfig = saveConfig;
exports.clearConfig = clearConfig;
exports.requireToken = requireToken;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const CONFIG_DIR = path_1.default.join(os_1.default.homedir(), '.nexusai');
const CONFIG_PATH = path_1.default.join(CONFIG_DIR, 'config.json');
const DEFAULT_API_URL = 'https://nexusai.run';
function getConfig() {
    const envToken = process.env.NEXUSAI_TOKEN;
    const envApiUrl = process.env.NEXUSAI_API_URL;
    let fileConfig = {};
    if (fs_1.default.existsSync(CONFIG_PATH)) {
        try {
            fileConfig = JSON.parse(fs_1.default.readFileSync(CONFIG_PATH, 'utf8'));
        }
        catch {
            // ignore malformed config
        }
    }
    return {
        apiUrl: envApiUrl || fileConfig.apiUrl || DEFAULT_API_URL,
        token: envToken || fileConfig.token || '',
        tokenId: fileConfig.tokenId || '',
    };
}
function saveConfig(config) {
    if (!fs_1.default.existsSync(CONFIG_DIR)) {
        fs_1.default.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
    fs_1.default.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}
function clearConfig() {
    if (fs_1.default.existsSync(CONFIG_PATH)) {
        fs_1.default.unlinkSync(CONFIG_PATH);
    }
}
function requireToken() {
    const config = getConfig();
    if (!config.token) {
        console.error("Not logged in. Run 'nexus auth login' first.");
        process.exit(1);
    }
    return config.token;
}
//# sourceMappingURL=config.js.map