import test from 'node:test';
import assert from 'node:assert/strict';
import * as policy from '../dist/project-policy.js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir, userInfo, hostname } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
function fixture(t) { const p = mkdtempSync(join(tmpdir(), 'reqall-policy-')); t.after(() => rmSync(p, { recursive:true, force:true })); return p; }

test('label grammar preserves deliberate names and ignores prose paths', () => {
  for (const [text, name] of [["project: 'a space.user'", 'a space.user'], ['project_name = `Org/Repo`', 'Org/Repo'], ['project: "a?!"', 'a?!'], ['project: org/repo.)]', 'org/repo'], ['some/project: no', ''], ['myproject: no', ''], ['work on /home/project/src', ''], ['project: src', 'src']]) assert.equal(policy.extractProjectHint(text), name);
});
test('override then Git then current label then retained selection then machine', t => {
  const cwd = fixture(t); const env = { REQALL_MACHINE_NAME: 'Lab.Example Com' };
  assert.equal(policy.machineProjectName(env), `.machine/lab.example-com/${userInfo().username}`);
  assert.equal(policy.machineProjectName({}), `.machine/${hostname().split('.')[0].toLowerCase()}/${userInfo().username}`);
  assert.deepEqual(policy.resolveProjectBinding(cwd, env), {name:policy.machineProjectName(env), source:'machine'});
  assert.deepEqual(policy.resolveProjectBinding(cwd, env, 'project: New.user', 'Old'), {name:'New.user',source:'prompt'});
  assert.equal(policy.resolveProjectBinding(cwd, env, 'ordinary prose', ' Old ').name, 'Old');
  execFileSync('git', ['init', '-q', cwd]); execFileSync('git', ['-C', cwd, 'remote', 'add', 'origin', 'https://host/group/team/repo.git']);
  assert.deepEqual(policy.resolveProjectBinding(cwd, env, 'project: label'), {name:'team/repo',source:'git'});
  assert.deepEqual(policy.resolveProjectBinding(cwd, {...env,REQALL_PROJECT_NAME:' Weird name.user '}, 'project: label'), {name:'Weird name.user',source:'override'});
  assert.equal(policy.resolveProjectBinding(cwd, {...env,REQALL_PROJECT_NAME:'  '}).source, 'git');
});

test('async subagent report preserves retained selection without rejecting ordinary text', t => {
  const cwd = fixture(t);
  const report = '[ASYNC SUBAGENT REPORT] example project_name=wrong/example; tests complete';
  for (const prompt of [report, ` \n${report}`]) {
    assert.deepEqual(policy.resolveProjectBinding(cwd, {}, prompt, 'acme/chosen'), {name:'acme/chosen',source:'prompt'});
    assert.equal(policy.extractProjectHint(prompt), '');
  }
  for (const prompt of ['Discuss [ASYNC SUBAGENT REPORT] project_name=acme/chosen',
      '[ASYNC SUBAGENT REPORTING] project_name=acme/chosen',
      'ASYNC SUBAGENT REPORT project_name=acme/chosen']) {
    assert.equal(policy.extractProjectHint(prompt), 'acme/chosen');
  }
});

test('YAML continuations never truncate identity', t => {
  const cwd = fixture(t);
  writeFileSync(join(cwd, 'package.json'), '{"name":"fallback"}');
  for (const continuation of ['  continuation', '  child: nested']) {
    writeFileSync(join(cwd, '.reqall.yml'), `project: wrong\n${continuation}\n`);
    assert.deepEqual(policy.localPortableBinding(cwd, {REQALL_WORKSPACE_ROOT:cwd}), {name:'fallback',source:'package'});
  }
});

test('Cargo multiline strings never supply package name', t => {
  const cwd = fixture(t); const leaf = join(cwd, 'leaf'); mkdirSync(leaf);
  writeFileSync(join(cwd, 'package.json'), '{"name":"fallback"}');
  for (const quote of ['"'.repeat(3), "'".repeat(3)]) {
    writeFileSync(join(leaf, 'Cargo.toml'), `[package]\ndescription = ${quote}\nname = "wrong"\n${quote}\n`);
    assert.deepEqual(policy.localPortableBinding(leaf, {REQALL_WORKSPACE_ROOT:cwd}), {name:'fallback',source:'package'});
  }
});

test('Go comments never join module tokens', t => {
  const cwd = fixture(t);
  writeFileSync(join(cwd, 'Cargo.toml'), '[package]\nname = "fallback"');
  writeFileSync(join(cwd, 'go.mod'), 'module example.com/ac/* comment */me/repo\n');
  assert.deepEqual(policy.localPortableBinding(cwd, {REQALL_WORKSPACE_ROOT:cwd}), {name:'fallback',source:'package'});
  for (const declaration of ['/* header */ module example.com/acme/repo/v2 // comment',
      'module/* separator */example.com/acme/repo/v2', 'module example.com/acme/repo/v2/* trailing */']) {
    writeFileSync(join(cwd, 'go.mod'), declaration);
    assert.equal(policy.localPortableBinding(cwd, {REQALL_WORKSPACE_ROOT:cwd}).name, 'example.com/acme/repo/v2');
  }
});

test('network remotes keep final two segments, never local paths', () => {
  for (const remote of ['https://host/group/team/repo.git/', 'ssh://git@host/group/team/repo.git', 'git@host:group/team/repo.git', 'git://host/team/repo', 'http://host/team/repo']) assert.equal(policy.normalizeRemote(remote), 'team/repo');
  for (const remote of ['/tmp/team/repo.git', 'C:\\team\\repo.git', 'C:/team/repo.git', 'file:///team/repo.git', '../team/repo', '//host/team/repo']) assert.equal(policy.normalizeRemote(remote), '');
  // Escapes, Unicode, spaces, and shell characters fail the automatic-name grammar.
  for (const remote of ['https://host/org/r%C3%A9po.git', 'git@host:org/my repo.git', 'https://host/org/rép.git', 'ssh://git@host/org/re$po.git', 'git@host: org/repo.git', 'git@host:org/repo .git']) assert.equal(policy.normalizeRemote(remote), '', remote);
  assert.equal(policy.normalizeRemote('git@host:org/valid_repo.v2.git'), 'org/valid_repo.v2');
});
