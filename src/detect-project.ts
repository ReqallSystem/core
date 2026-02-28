import { execSync } from 'node:child_process';
import { basename } from 'node:path';

export function detectProject(cwd?: string): string {
  if (process.env.REQALL_PROJECT_NAME) {
    return process.env.REQALL_PROJECT_NAME;
  }

  try {
    const remote = execSync('git remote get-url origin', {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const match = remote.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (match) {
      return match[1];
    }
  } catch {
    // Not a git repo or no remote — fall through
  }

  return basename(cwd || process.cwd());
}
