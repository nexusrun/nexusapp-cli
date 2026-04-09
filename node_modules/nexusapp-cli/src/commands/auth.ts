import { Command } from 'commander';
import http from 'http';
import { execFile } from 'child_process';
import { AddressInfo } from 'net';
import axios from 'axios';
import { getConfig, saveConfig, clearConfig } from '../config.js';
import { client, apiError, unwrap } from '../client.js';
import { success, errorMsg, printJson, printTable, spinner } from '../output.js';

function openBrowser(url: string): void {
  const platform = process.platform;
  if (platform === 'darwin') {
    execFile('open', [url], () => {});
  } else if (platform === 'win32') {
    execFile('cmd', ['/c', 'start', '', url], () => {});
  } else {
    execFile('xdg-open', [url], () => {});
  }
}

function successHtml(webUrl: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>NEXUS AI CLI</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#0b0c12;color:#e5e7eb}
.box{text-align:center;padding:2.5rem 3rem;background:#ffffff08;border:1px solid #ffffff14;border-radius:1.25rem;max-width:360px;width:90%}
.logo{display:flex;align-items:center;justify-content:center;gap:.65rem;margin-bottom:2rem}
.logo img{height:2.25rem;width:2.25rem}
.logo-name{font-size:1rem;font-weight:600;color:#fff;letter-spacing:-.01em}
.check{width:2.75rem;height:2.75rem;background:#0ea5e920;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem}
.check svg{width:1.25rem;height:1.25rem;stroke:#38bdf8;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}
.title{font-size:1.2rem;font-weight:700;color:#fff;margin-bottom:.4rem}
.sub{color:#6b7280;font-size:.85rem;line-height:1.5}
</style></head>
<body><div class="box">
  <div class="logo">
    <img src="${webUrl}/logo.svg" alt="NEXUS AI" onerror="this.style.display='none'">
    <span class="logo-name">NEXUS AI</span>
  </div>
  <div class="check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
  <div class="title">Authorization successful</div>
  <div class="sub">You can close this tab and return to your terminal.</div>
</div></body></html>`;
}

function waitForCallback(server: http.Server, webUrl: string): Promise<{ token: string; tokenId: string; email: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Timed out waiting for browser authorization (2 minutes).'));
    }, 120_000);

    server.on('request', (req, res) => {
      const url = new URL(req.url!, `http://localhost`);
      const token = url.searchParams.get('token');
      const tokenId = url.searchParams.get('tokenId') || '';
      const email = url.searchParams.get('email') || '';

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(successHtml(webUrl));

      clearTimeout(timeout);
      server.close();

      if (!token) {
        reject(new Error('No token received from browser.'));
      } else {
        resolve({ token, tokenId, email });
      }
    });
  });
}

export function registerAuth(program: Command): void {
  const auth = program.command('auth').description('Authentication commands');

  // login
  auth
    .command('login')
    .description('Log in to NEXUS AI via browser')
    .option('--api-url <url>', 'Backend API base URL (e.g. http://localhost:3001)')
    .option('--web-url <url>', 'Frontend URL (e.g. http://localhost:3002)')
    .option('--token <token>', 'Use an existing nxk_* access token directly')
    .action(async (opts) => {
      const apiUrl = opts.apiUrl || process.env.NEXUSAI_API_URL || 'https://nexusai.run';
      const webUrl = opts.webUrl || process.env.NEXUSAI_WEB_URL
        || apiUrl.replace(':3001', ':3002').replace('api.nexusai.run', 'nexusai.run');

      // --token shortcut: skip browser
      if (opts.token) {
        try {
          const res = await axios.get(`${apiUrl}/api/auth/verify`, {
            headers: { Authorization: `Bearer ${opts.token}` },
          });
          const user = res.data;
          saveConfig({ apiUrl, token: opts.token, tokenId: '' });
          success(`Logged in as ${user.email || user.user?.email}`);
        } catch (err) {
          errorMsg('Token verification failed: ' + apiError(err));
          process.exit(1);
        }
        return;
      }

      // Start local callback server on a random port
      const server = http.createServer();
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const port = (server.address() as AddressInfo).port;

      const callbackUrl = `http://localhost:${port}`;
      const authUrl = `${webUrl}/cli-auth?callback=${encodeURIComponent(callbackUrl)}`;

      console.log('');
      console.log('Opening your browser to complete login...');
      console.log('');
      console.log(`  ${authUrl}`);
      console.log('');
      console.log('If the browser did not open, copy the URL above into your browser.');
      console.log('');

      openBrowser(authUrl);

      const spin = spinner('Waiting for browser authorization...');

      try {
        const { token, tokenId, email } = await waitForCallback(server, webUrl);
        saveConfig({ apiUrl, token, tokenId });
        spin.stop();
        success(`Logged in as ${email}`);
      } catch (err) {
        spin.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // logout
  auth
    .command('logout')
    .description('Log out and revoke access token')
    .action(async () => {
      const config = getConfig();
      if (!config.token) {
        console.log('Not logged in.');
        return;
      }

      if (config.tokenId) {
        try {
          await client.post(`/api/tokens/${config.tokenId}/revoke`);
        } catch {
          // best-effort revocation
        }
      }

      clearConfig();
      success('Logged out.');
    });

  // whoami
  auth
    .command('whoami')
    .description('Show current authenticated user')
    .option('--json', 'Output raw JSON')
    .action(async (opts) => {
      try {
        const res = await client.get('/api/auth/verify');
        const user = unwrap(res.data);
        if (opts.json) {
          printJson(user);
          return;
        }
        const u = user.user || user;
        const email = u.email || 'unknown';
        const org = u.organization?.name || u.organizationId || '—';
        const role = u.role || '—';
        printTable(['Field', 'Value'], [
          ['Email', email],
          ['Organization', org],
          ['Role', role],
        ]);
      } catch (err) {
        errorMsg(apiError(err));
        process.exit(1);
      }
    });
}
