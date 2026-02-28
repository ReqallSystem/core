import { randomBytes } from 'node:crypto';
import { exec } from 'node:child_process';
import { platform } from 'node:os';

export interface AuthOptions {
  serverUrl: string;
  keyName: string;
  onStatus?: (msg: string) => void;
}

export interface AuthResult {
  apiKey: string;
  keyName: string;
}

function openBrowser(url: string): void {
  const plat = platform();
  const cmd = plat === 'darwin' ? 'open'
    : plat === 'win32' ? 'start'
    : 'xdg-open';
  exec(`${cmd} "${url}"`);
}

/**
 * Authenticate with Reqall via the browser polling flow.
 *
 * 1. Generates a session token
 * 2. Calls POST /auth/plugin/init to create a pending auth session
 * 3. Opens the browser to the auth URL
 * 4. Polls GET /auth/plugin/poll until the user completes login
 * 5. Returns the API key
 */
export async function authenticateViaOAuth(options: AuthOptions): Promise<AuthResult> {
  const { serverUrl, keyName, onStatus } = options;
  const baseUrl = serverUrl.replace(/\/$/, '');

  // 1. Generate session token
  const sessionToken = randomBytes(32).toString('hex');

  // 2. Initialize auth session
  onStatus?.('Initializing authentication session...');
  const initRes = await fetch(`${baseUrl}/auth/plugin/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_token: sessionToken, key_name: keyName }),
  });

  if (!initRes.ok) {
    const body = await initRes.text();
    throw new Error(`Failed to initialize auth: ${initRes.status} ${body}`);
  }

  const { auth_url } = (await initRes.json()) as { auth_url: string };

  // 3. Open browser
  onStatus?.('Opening browser for authentication...');
  onStatus?.(`If the browser does not open, visit: ${auth_url}`);
  openBrowser(auth_url);

  // 4. Poll for completion
  const pollUrl = `${baseUrl}/auth/plugin/poll?session_token=${sessionToken}`;
  const maxAttempts = 60; // 10 min at 10s intervals
  const interval = 10_000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, interval));

    const pollRes = await fetch(pollUrl);

    if (pollRes.status === 200) {
      const data = (await pollRes.json()) as { api_key: string; key_name: string };
      return { apiKey: data.api_key, keyName: data.key_name };
    }

    if (pollRes.status === 404) {
      throw new Error('Auth session expired or not found.');
    }

    // 202 = still pending
    onStatus?.(`Waiting for authentication... (${i + 1}/${maxAttempts})`);
  }

  throw new Error('Timed out waiting for authentication.');
}
