import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { syncBuiltinESMExports } from 'node:module';
import { machineProjectName, extractProjectHint, resolveProjectBinding } from '../dist/project-policy.js';

test('recognized synthetic delegation prefixes cannot rebind quoted project examples', () => {
  for (const prefix of ['BATCH COMPLETE', 'COMPLETE', 'TASK FAILED']) {
    const prompt = ` \n[ASYNC DELEGATION ${prefix} — task]\nExample: project="wrong/example"`;
    assert.equal(extractProjectHint(prompt), '');
    assert.deepEqual(resolveProjectBinding('/nonexistent/reqall-policy-cwd', {}, prompt, 'retained/project'), {name:'retained/project', source:'prompt'});
  }
  for (const prompt of ['project="real/project" mentions [ASYNC DELEGATION COMPLETE]', '[ASYNC DELEGATION COMPLETELY different] project=real/project', '[ASYNC DELEGATION TASK FAILEDNESS] project=real/project', 'Discuss ASYNC DELEGATION; project=real/project']) {
    assert.equal(extractProjectHint(prompt), 'real/project');
  }
});

test('unquoted labels stop at comma and semicolon, quoted punctuation survives', () => {
  for (const delimiter of [',', ';']) {
    assert.equal(extractProjectHint(`project_name=acme/repo${delimiter}continue`), 'acme/repo');
    for (const quote of ['"', "'", '`']) {
      assert.equal(extractProjectHint(`project=${quote}acme/repo${delimiter}continue?!${quote}`), `acme/repo${delimiter}continue?!`);
    }
  }
});

test('OS identity exceptions and empty accounts use unknown', () => {
  const unavailable = () => { throw new Error('OS identity unavailable'); };
  for (const username of [unavailable, '', '--- / \\ ---']) {
    withIdentity(unavailable, username, () => {
      assert.equal(machineProjectName({USER:'not-the-account'}), '.machine/unknown/unknown');
      assert.equal(machineProjectName({REQALL_MACHINE_NAME:'STABLE.Host'}), '.machine/stable.host/unknown');
    });
  }
});

// OS failures and unusual account names require replacing the OS boundary.
function withIdentity(hostname, username, action) {
  const originalHost = os.hostname, originalUser = os.userInfo;
  os.hostname = typeof hostname === 'function' ? hostname : () => hostname;
  os.userInfo = typeof username === 'function' ? username : () => ({ username });
  syncBuiltinESMExports();
  try { action(); } finally {
    os.hostname = originalHost; os.userInfo = originalUser; syncBuiltinESMExports();
  }
}

test('machine segments retain vetted cleaning and whole hostname overrides', () => {
  withIdentity(' --LAB/Box.Example.org', ' --Domain\\User Name-- ', () => {
    assert.equal(machineProjectName({USER:'ignored', USERNAME:'ignored'}), '.machine/lab-box/Domain-User-Name');
    assert.equal(machineProjectName({REQALL_MACHINE_NAME:' --LAB.Example/@Box_é-- '}), '.machine/lab.example-@box_é/Domain-User-Name');
    assert.equal(machineProjectName({REQALL_MACHINE_NAME:'--- / \\ ---'}), '.machine/unknown/Domain-User-Name');
  });
});
