import { resolveProjectBinding } from './project-policy.js';

/** Backward-compatible string API; prompt labels are optional. */
export function detectProject(cwd = process.cwd(), prompt = ''): string {
  return resolveProjectBinding(cwd, process.env, prompt).name;
}
