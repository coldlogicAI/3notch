import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('e2e V2 workflow smokes', () => {
  it('walks a supersedes chain from relationships.json', async () => {
    await withTempProject({ prefix: 'notch-e2e-wiki-' }, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'wiki-app'], { cwd: project.path });
      const first = await mark(project.path, 'Original wiki note');
      const second = await mark(project.path, 'Updated wiki note', first.packet.id);
      const third = await mark(project.path, 'Final wiki note', second.packet.id);
      const relationships = await readRelationships(project.path);
      const supersedes = relationships.edges.filter((edge) => edge.type === 'supersedes');
      const forward = new Map(supersedes.map((edge) => [edge.to, edge.from]));
      const backward = new Map(supersedes.map((edge) => [edge.from, edge.to]));

      expect(supersedes).toEqual(expect.arrayContaining([
        expect.objectContaining({ from: second.packet.id, to: first.packet.id }),
        expect.objectContaining({ from: third.packet.id, to: second.packet.id }),
      ]));
      expect([forward.get(first.packet.id), forward.get(second.packet.id)]).toEqual([second.packet.id, third.packet.id]);
      expect([backward.get(third.packet.id), backward.get(second.packet.id)]).toEqual([second.packet.id, first.packet.id]);
    });
  }, 20_000);

  it('authors typed replies and indexes both reply edges', async () => {
    await withTempProject({ prefix: 'notch-e2e-reply-' }, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'reply-e2e'], { cwd: project.path });
      const parent = await createPacket(project.path, 'Reply parent', 'Parent summary.');
      const question = await runCli([
        '--json',
        'reply',
        parent.packet.id,
        '--type',
        'question',
        '--summary',
        'What order should the migration use?',
      ], { cwd: project.path });
      const questionData = JSON.parse(question.stdout) as PacketCommandResult;
      const clarification = await runCli([
        '--json',
        'reply',
        questionData.packet.id,
        '--type',
        'clarification',
        '--summary',
        'Use schema changes before CLI wiring.',
      ], { cwd: project.path });
      const clarificationData = JSON.parse(clarification.stdout) as PacketCommandResult;
      const relationships = await readRelationships(project.path);

      expect(questionData.packet).toMatchObject({
        replyTo: parent.packet.id,
        replyType: 'question',
        status: 'open',
      });
      expect(relationships.edges).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'replyTo', from: questionData.packet.id, to: parent.packet.id }),
        expect.objectContaining({ type: 'replyTo', from: clarificationData.packet.id, to: questionData.packet.id }),
      ]));
    });
  }, 20_000);

  it('imports a web-chat packet through stdin and scans stdin content', async () => {
    await withTempProject({ prefix: 'notch-e2e-web-chat-' }, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'web-chat-e2e'], { cwd: project.path });
      const prompt = await runCli(['prompt', '--client', 'claude-chat'], { cwd: project.path });
      const packet = webChatPacket('packet_web_chat_bridge');
      const imported = await runCli(['--json', 'packet', 'import', '-'], {
        cwd: project.path,
        input: packet,
      });
      const importedData = JSON.parse(imported.stdout) as { inboxPath: string };
      const audit = await readFile(path.join(project.path, '.notch/logs/audit.jsonl'), 'utf8');
      const blocked = await runCli(['--json', 'packet', 'import', '-'], {
        cwd: project.path,
        input: `${packet}\napi_key=abc123\n`,
      });

      expect(prompt.stdout).toContain('pbpaste | notch packet import -');
      expect(imported.exitCode).toBe(0);
      expect(importedData.inboxPath).toContain(path.join('.notch', 'private', 'inbox'));
      expect(audit).toContain('"operation":"import"');
      expect(blocked.exitCode).toBe(5);
      expect(JSON.parse(blocked.stderr)).toMatchObject({ error: { code: 'NOTCH_SECRET_DETECTED' } });
    });
  }, 20_000);

  it('captures marks and indexes a mark supersedes edge', async () => {
    await withTempProject({ prefix: 'notch-e2e-mark-' }, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'mark-e2e'], { cwd: project.path });
      const first = await mark(project.path, 'Decided cookies over JWT');
      const second = await mark(project.path, 'Prefer signed cookies for browser auth', first.packet.id);
      const relationships = await readRelationships(project.path);

      expect(first.path).toContain(path.join('.notch', 'private', 'inbox'));
      expect(second.packet.supersedes).toBe(first.packet.id);
      expect(relationships.edges).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'supersedes', from: second.packet.id, to: first.packet.id }),
      ]));
    });
  }, 20_000);

  it('reports each V2 check rule exactly once and clean stores as zero findings', async () => {
    await withTempProject({ prefix: 'notch-e2e-check-' }, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'check-e2e'], { cwd: project.path });
      const brokenSupersedes = await createPacket(project.path, 'Broken supersedes', 'Broken supersedes summary.', 'packet_missing_supersedes');
      const brokenReply = await createPacket(project.path, 'Broken reply', 'Broken reply summary.');
      await replaceInFile(brokenReply.path, 'status: active', 'status: open');
      await insertFrontmatterLine(brokenReply.path, 'summary: Broken reply summary.', 'replyTo: packet_missing_reply\nreplyType: question');
      const self = await createPacket(project.path, 'Self reference', 'Self reference summary.');
      await insertFrontmatterLine(self.path, 'summary: Self reference summary.', `supersedes: ${self.packet.id}`);
      const cycleA = await createPacket(project.path, 'Cycle A', 'Cycle A summary.');
      const cycleB = await createPacket(project.path, 'Cycle B', 'Cycle B summary.', cycleA.packet.id);
      await insertFrontmatterLine(cycleA.path, 'summary: Cycle A summary.', `supersedes: ${cycleB.packet.id}`);
      const forkParent = await createPacket(project.path, 'Fork parent', 'Fork parent summary.');
      await createPacket(project.path, 'Fork child one', 'Fork child one summary.', forkParent.packet.id);
      await createPacket(project.path, 'Fork child two', 'Fork child two summary.', forkParent.packet.id);

      const text = await runCli(['check'], { cwd: project.path });
      const json = await runCli(['--json', 'check'], { cwd: project.path });
      const parsed = JSON.parse(json.stdout) as {
        findings: Array<{ rule: string; packetId: string; severity: string }>;
      };
      const clean = await withTempProject({ prefix: 'notch-e2e-check-clean-' }, async (cleanProject) => {
        await runCli(['onboard', '--yes', '--name', 'clean-check-e2e'], { cwd: cleanProject.path });
        return await runCli(['--json', 'check'], { cwd: cleanProject.path });
      });

      expect(brokenSupersedes.packet.supersedes).toBe('packet_missing_supersedes');
      expect(text.exitCode).toBe(1);
      expect(json.exitCode).toBe(1);
      for (const rule of [
        'CHECK_SUPERSEDES_BROKEN',
        'CHECK_REPLYTO_BROKEN',
        'CHECK_SUPERSEDES_CYCLE',
        'CHECK_SELF_REFERENCE',
        'CHECK_SUPERSEDES_FORK',
      ]) {
        expect(parsed.findings.filter((finding) => finding.rule === rule)).toHaveLength(1);
      }
      expect(parsed.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ rule: 'CHECK_SUPERSEDES_FORK', severity: 'warn', packetId: forkParent.packet.id }),
      ]));
      expect(JSON.parse(clean.stdout)).toMatchObject({ findings: [], summary: { errors: 0, warnings: 0 } });
    });
  }, 25_000);
});

type PacketCommandResult = {
  packet: {
    id: string;
    replyTo?: string;
    replyType?: string;
    status?: string;
    supersedes?: string;
  };
  path: string;
};

async function createPacket(projectPath: string, title: string, summary: string, supersedes?: string): Promise<PacketCommandResult> {
  const result = await runCli([
    '--json',
    'packet',
    'create',
    '--title',
    title,
    '--summary',
    summary,
    '--to-agent',
    'codex',
    ...(supersedes ? ['--supersedes', supersedes] : []),
  ], { cwd: projectPath });
  const parsed = JSON.parse(result.stdout) as { outboxPath: string; packet: PacketCommandResult['packet'] };

  return { packet: parsed.packet, path: parsed.outboxPath };
}

async function mark(projectPath: string, summary: string, supersedes?: string): Promise<PacketCommandResult> {
  const result = await runCli([
    '--json',
    'mark',
    '--summary',
    summary,
    '--tags',
    'auth',
    ...(supersedes ? ['--supersedes', supersedes] : []),
  ], { cwd: projectPath });

  return JSON.parse(result.stdout) as PacketCommandResult;
}

async function readRelationships(projectPath: string): Promise<{ edges: Array<{ type: string; from: string; to: string }> }> {
  return JSON.parse(await readFile(path.join(projectPath, '.notch/index/relationships.json'), 'utf8')) as {
    edges: Array<{ type: string; from: string; to: string }>;
  };
}

async function insertFrontmatterLine(filePath: string, marker: string, line: string): Promise<void> {
  const markdown = await readFile(filePath, 'utf8');
  await writeFile(filePath, markdown.replace(marker, `${marker}\n${line}`), 'utf8');
}

async function replaceInFile(filePath: string, search: string, replacement: string): Promise<void> {
  const markdown = await readFile(filePath, 'utf8');
  await writeFile(filePath, markdown.replace(search, replacement), 'utf8');
}

function webChatPacket(id: string): string {
  return `---
id: ${id}
schemaVersion: "1.0.0"
recordType: packet
status: active
title: Web chat bridge packet
purpose: seed
sensitivity: private
transferStatus: outbox
origin:
  projectName: claude-chat
  storePath: claude-chat
recipient: {}
summary: Web chat selected project context.
includedRecords: []
includedSourceLinks: []
createdAt: 2026-05-24T12:00:00Z
createdBy:
  actorType: agent
  name: Claude Chat
sourceTool:
  name: claude
  client: claude-chat
tags: []
sourceLinks: []
reviewStatus: unreviewed
---

## Summary

Web chat selected project context.

## Recipient

The user's local project inbox.

## Origin

Claude Chat conversation.

## Included Context

- None.

## Source Links

- None.

## Import Notes

Review before use.

## User Preferences

- None.

## Workflow Conventions

- Preserve explicit context only.

## Lessons From Prior Work

- None.

## What Not To Carry Forward

- Hidden chat history.
`;
}
