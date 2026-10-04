import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import * as core from '../dist/index.js';

test('public detectProject supports prompt and canonical exports', t => {
 const cwd = mkdtempSync(join(tmpdir(), 'reqall-core-')); t.after(()=>rmSync(cwd,{recursive:true,force:true}));
 assert.equal(core.detectProject(cwd, 'project: .user'), '.user');
 assert.equal(typeof core.resolveProjectBinding, 'function');
});
test('npm pack builds and contains each executable export and declarations', () => {
 const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url),'utf8'));
 assert.equal(pkg.scripts.prepack, 'npm run build');
 const result = JSON.parse(execFileSync('npm',['pack','--dry-run','--json'],{encoding:'utf8'}));
 const files = new Set(result[0].files.map(f=>f.path));
 for (const path of Object.values(pkg.exports)) assert.ok(files.has(path.replace(/^\.\//,'')),path);
 assert.ok(files.has('dist/project-policy.d.ts'));
 assert.ok(!files.has('test/project-policy.test.mjs'));
});
