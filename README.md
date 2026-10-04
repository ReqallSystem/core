# @reqall/core

Core utilities for Reqall. Run `npm install --ignore-scripts` and `npm test`.
`npm pack` builds first and includes the compiled JavaScript and declarations in
`dist`. No runtime dependencies are required by the project policy.

## Canonical project binding

```ts
import { resolveProjectBinding, detectProject } from '@reqall/core';
const binding = resolveProjectBinding(process.cwd(), process.env, 'project: acme/notes');
// { name: 'acme/notes', source: 'prompt' } (unless override or Git wins)
const name = detectProject(process.cwd(), 'project: acme/notes');
```

`src/project-policy.ts` is the canonical, standalone implementation. Hosts may
vendor that exact file or its emitted `dist/project-policy.js`. The public
`@reqall/core/project-policy` subpath and main entry export:

- `ProjectBinding { name: string; source: string }`
- `resolveProjectBinding(cwd = process.cwd(), env = process.env, prompt = '', selected = '')`
- `normalizeRemote(remote): string`
- `extractProjectHint(text): string`
- `machineProjectName(env = process.env): string`
- `localPortableBinding(cwd, env = process.env): ProjectBinding | undefined`

The string-returning `detectProject(cwd?, prompt?)` is backward-compatible.

### Precedence

1. Trimmed, nonempty `REQALL_PROJECT_NAME` (`override`).
2. Network Git `origin` (`git`), queried with argv, no shell, and a five-second timeout.
3. Current explicitly labelled prompt, otherwise retained `selected` (`prompt`).
4. Nearest valid ancestor `.reqall.yml`, then `.reqall.yaml` (`reqall_yml`).
5. Nearest valid package declaration (`package`): package.json, go.mod, Cargo.toml
   in that order **per directory**.
6. Exact workspace-relative POSIX path (`workspace_relative`).
7. `.machine/<short-lower-hostname>/<os-user>` (`machine`).

Explicit overrides and prompt/retained selections are trimmed, not validated or
rewritten; `.user` remains available. Callers must pass actual user prompt text,
not synthetic notifications or quoted instructional examples. As a defensive guard,
leading `[ASYNC DELEGATION BATCH COMPLETE`, `[ASYNC DELEGATION COMPLETE`, and
`[ASYNC DELEGATION TASK FAILED` notifications (after optional whitespace, with a
word boundary after the status) are ignored before label extraction.
Label grammar is
`(?<![\w/-])project(?:_name)?\s*[:=]` (case-insensitive), followed by a double-,
single-, backtick-quoted value or an unquoted value ending at whitespace, a quote,
comma, or semicolon. Only
unquoted values lose trailing sentence punctuation `.,:;!?)\]`. Incidental paths
and arbitrary slash tokens do not select a project.

HTTP(S), SSH, Git URLs and SCP-style origins retain their **final two path
segments**, removing trailing slashes and terminal `.git`. Local POSIX/Windows
and file origins are rejected. Nested namespaces intentionally keep historical
server behavior (`group/sub/repo` becomes `sub/repo`). No records are migrated or
renamed by discovery.

Machine account identity comes from `os.userInfo()`, never `USER`/`USERNAME`.
`REQALL_MACHINE_NAME` replaces the entire hostname segment; dots are retained in
this explicit override. Both host and OS account segments use the vetted cleaning:
trim, replace runs of slash/backslash/whitespace with `-`, strip leading/trailing
hyphens, and use `unknown` if empty. Only the cleaned host is lowercased; other
characters are preserved for existing machine-ID compatibility. OS lookup failures
use `unknown` for the unavailable hostname or account.

### Portable metadata and boundaries

Metadata reads are bounded to 64 KiB, regular files only, and strict UTF-8.
Unreadable, oversized, non-string, invalid or unsupported declarations are
skipped. Automatic names consist of ASCII alphanumeric/`._-` segments separated
by `/`; absolute/drive/UNC/backslash/tilde paths and empty, `.` or `..` segments
are rejected before normalization. `src` and `work` are valid explicit metadata.

YAML supports only top-level `project` and alias `name` simple scalars; a valid
`project` wins. Matching single/double quotes and trailing comments are supported.
Plain null, boolean and numeric scalars are rejected. Contradictory duplicate
keys are rejected. This is not a general YAML parser: nested values, aliases,
escapes and multiline scalars are unsupported.

JSON requires a string `name`; only a valid `@scope/name` removes one `@`.
Go keeps the complete module path, including domain and major-version suffix;
comments and simple quoted declarations are supported. Cargo accepts only a
simple basic/literal quoted `name` in `[package]`, never bin/dependency names;
complex TOML and escapes are unsupported.

Scan ancestors to a known containing workspace root, inclusive, or filesystem
root. `REQALL_WORKSPACE_ROOT` is resolved relative to cwd (`~/` uses OS home).
Otherwise the nearest ancestor regular `.reqall-workspace` file marks the root.
An invalid or non-containing configured root suppresses marker fallback but does
not stop metadata lookup. Realpath containment prevents symlink escape. Root
itself supplies no relative identity; all relative segments are preserved,
including `src` and `work`. There is no unconstrained basename fallback.
