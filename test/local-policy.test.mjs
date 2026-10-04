import test from 'node:test';
import assert from 'node:assert/strict';
import * as p from '../dist/project-policy.js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
function fixture(t) { const root = mkdtempSync(join(tmpdir(),'reqall-local-')); t.after(()=>rmSync(root,{recursive:true,force:true})); const cwd=join(root,'work','src'); mkdirSync(cwd,{recursive:true}); return {root,cwd,env:{REQALL_WORKSPACE_ROOT:root}}; }

test('YAML nearest valid ancestor, yml priority and project over name', t=>{
 const {root,cwd,env}=fixture(t);
 writeFileSync(join(root,'.reqall.yml'),'name: fallback\nproject: "Org/repo.user" # comment\n');
 writeFileSync(join(cwd,'package.json'),'{"name":"npm"}');
 writeFileSync(join(cwd,'.reqall.yml'),'project: true\n');
 assert.deepEqual(p.localPortableBinding(cwd,env),{name:'Org/repo.user',source:'reqall_yml'});
 writeFileSync(join(cwd,'.reqall.yaml'),"project: 'src' # comment\n");
 assert.equal(p.localPortableBinding(cwd,env).name,'src');
 writeFileSync(join(cwd,'.reqall.yml'),'project: preferred\n');
 assert.equal(p.resolveProjectBinding(cwd,env).name,'preferred');
});

test('unsafe and nonstring YAML metadata fail closed', t=>{
 const {root,cwd,env}=fixture(t); writeFileSync(join(root,'.reqall.yml'),'project: valid\n');
 for (const value of ['null','false','12','1.2','.5','0xFF','0o77','[]','{}','"unterminated',"'bad\"",'/abs','../up','a/../b','a//b','C:/drive','a\\b','~/home','.', '..','project: bad']) {
 writeFileSync(join(cwd,'.reqall.yml'),`project: ${value}\n`); assert.equal(p.localPortableBinding(cwd,env).name,'valid',value);
 }
 writeFileSync(join(cwd,'.reqall.yml'),'project: first\nproject: second\n'); assert.equal(p.localPortableBinding(cwd,env).name,'valid');
});

test('package nearest-directory precedence, scoped npm and complete Go paths', t=>{
 const {root,cwd,env}=fixture(t); writeFileSync(join(root,'package.json'),'{"name":"parent"}');
 writeFileSync(join(cwd,'go.mod'),'// heading\nmodule "github.com/acme/widget/v2" // comment\n');
 assert.deepEqual(p.localPortableBinding(cwd,env),{name:'github.com/acme/widget/v2',source:'package'});
 writeFileSync(join(cwd,'package.json'),'{"name":"@scope/src"}'); assert.equal(p.localPortableBinding(cwd,env).name,'scope/src');
 for (const name of [true,4,'@@scope/name','@scope','@scope/a/b','a//b','/abs','src/../x']) {writeFileSync(join(cwd,'package.json'),JSON.stringify({name})); assert.equal(p.localPortableBinding(cwd,env).name,'github.com/acme/widget/v2');}
 writeFileSync(join(cwd,'package.json'),'{"name":"src"}'); assert.equal(p.localPortableBinding(cwd,env).name,'src');
});

test('Cargo package only with basic and literal strings', t=>{
 const {cwd,env}=fixture(t);
 for (const quote of ['"',"'"]) {writeFileSync(join(cwd,'Cargo.toml'),`[[bin]]\nname = "wrong"\n[package]\nname = ${quote}cargo-name${quote} # comment\n[dependencies]\nname = "also-wrong"\n`); assert.equal(p.localPortableBinding(cwd,env).name,'cargo-name');}
 writeFileSync(join(cwd,'Cargo.toml'),'[dependencies]\nname = "wrong"\n'); assert.equal(p.localPortableBinding(cwd,env).source,'workspace_relative');
});

test('bounded regular UTF8 reads skip invalid metadata', t=>{
 const {root,cwd,env}=fixture(t); writeFileSync(join(root,'.reqall.yml'),'project: parent');
 for (const data of [Buffer.from([0xff,0xfe]), 'project: '+ 'a'.repeat(65536)]) {writeFileSync(join(cwd,'.reqall.yml'),data); assert.equal(p.localPortableBinding(cwd,env).name,'parent');}
 rmSync(join(cwd,'.reqall.yml')); mkdirSync(join(cwd,'.reqall.yml')); assert.equal(p.localPortableBinding(cwd,env).name,'parent');
});

test('workspace exact relative path, inclusive boundary, marker and invalid configured root', t=>{
 const {root,cwd,env}=fixture(t);
 assert.deepEqual(p.localPortableBinding(cwd,env),{name:'work/src',source:'workspace_relative'});
 assert.equal(p.localPortableBinding(root,env),undefined);
 assert.equal(p.localPortableBinding(cwd,{REQALL_WORKSPACE_ROOT:'../..'}).name,'work/src');
 writeFileSync(join(root,'.reqall-workspace'),'');
 assert.equal(p.localPortableBinding(cwd,{}).name,'work/src');
 assert.equal(p.localPortableBinding(cwd,{REQALL_WORKSPACE_ROOT:join(root,'missing')}),undefined);
 writeFileSync(join(root,'.reqall.yml'),'project: root'); assert.equal(p.localPortableBinding(cwd,env).name,'root');
});

for (const [file, content, source] of [
 ['.reqall.yml', 'project: linked-name\n', 'reqall_yml'],
 ['.reqall.yaml', 'project: linked-name\n', 'reqall_yml'],
 ['package.json', '{"name":"linked-name"}', 'package'],
 ['go.mod', 'module linked-name\n', 'package'],
 ['Cargo.toml', '[package]\nname = "linked-name"\n', 'package'],
]) {
 test(`${file} symlinks cannot escape a resolved workspace boundary`, t=>{
  const {root,cwd}=fixture(t);
  const boundary=join(root,'work');
  const outside=join(root,'work-sibling'); mkdirSync(outside);
  const target=join(outside,'metadata'); writeFileSync(target,content);
  symlinkSync(target,join(cwd,file));
  const alias=join(root,'workspace-alias'); symlinkSync(boundary,alias,'dir');
  assert.deepEqual(p.localPortableBinding(cwd,{REQALL_WORKSPACE_ROOT:alias}),{name:'src',source:'workspace_relative'});
  writeFileSync(join(boundary,'.reqall-workspace'),'');
  assert.deepEqual(p.localPortableBinding(cwd,{}),{name:'src',source:'workspace_relative'});
 });
 test(`${file} symlinks within the workspace remain valid`, t=>{
  const {root,cwd,env}=fixture(t);
  const target=join(root,'metadata'); writeFileSync(target,content);
  symlinkSync(target,join(cwd,file));
  assert.deepEqual(p.localPortableBinding(cwd,env),{name:'linked-name',source});
 });
}

test('realpath containment rejects symlink escape and scans no metadata above boundary', t=>{
 const {root,cwd,env}=fixture(t); const outside=fixture(t);
 symlinkSync(outside.cwd,join(root,'escape'),'dir');
 assert.equal(p.localPortableBinding(join(root,'escape'),env),undefined);
 writeFileSync(join(root,'.reqall.yml'),'project: above');
 assert.equal(p.localPortableBinding(cwd,{REQALL_WORKSPACE_ROOT:join(root,'work')}).name,'src');
});
