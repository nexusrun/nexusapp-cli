import fs from 'fs';
import path from 'path';
import os from 'os';

export interface Config {
  apiUrl: string;
  token: string;
  tokenId: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.nexusai');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_API_URL = 'https://nexusai.run';

export function getConfig(): Partial<Config> {
  const envToken = process.env.NEXUSAI_TOKEN;
  const envApiUrl = process.env.NEXUSAI_API_URL;

  let fileConfig: Partial<Config> = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch {
      // ignore malformed config
    }
  }

  return {
    apiUrl: envApiUrl || fileConfig.apiUrl || DEFAULT_API_URL,
    token: envToken || fileConfig.token || '',
    tokenId: fileConfig.tokenId || '',
  };
}

export function saveConfig(config: Config): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function clearConfig(): void {
  if (fs.existsSync(CONFIG_PATH)) {
    fs.unlinkSync(CONFIG_PATH);
  }
}

export function requireToken(): string {
  const config = getConfig();
  if (!config.token) {
    console.error("Not logged in. Run 'nexus auth login' first.");
    process.exit(1);
  }
  return config.token;
}
