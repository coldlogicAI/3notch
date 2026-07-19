export type SchemaVersion = '1.0.0' | string;

export type RecordType = 'config' | 'project_brief' | 'brief' | 'packet';
export type ActorType = 'human' | 'agent' | 'system';
export type ReviewStatus = 'unreviewed' | 'reviewed';
export type RecordStatus = 'draft' | 'active' | 'archived';
export type ReplyStatus = 'open' | 'resolved' | 'dismissed';
export type PacketStatus = RecordStatus | ReplyStatus;
export type PacketPurpose = 'handoff' | 'seed';
export type PacketArtifactPurpose = 'asset' | 'source' | 'reference' | 'output';
export type Sensitivity = 'project' | 'private';
export type ContinuationMode = 'off' | 'script' | 'prompt' | 'auto';
export type ClaudeCodeContinuationEvent =
  | 'SessionStart'
  | 'TaskCreated'
  | 'TaskCompleted'
  | 'PostCompact'
  | 'StopFailure:rate_limit'
  | 'Stop';
export type TransferStatus = 'draft' | 'outbox' | 'imported' | 'archived';
export type ReplyType = 'question' | 'clarification' | 'counter-decision' | 'objection' | 'confirmation';
export type AuditOperation =
  | 'create'
  | 'import'
  | 'rebuild-index'
  | 'scan-skip'
  | 'secret-blocked'
  | 'validation-failed';
export type AuditResult = 'success' | 'blocked' | 'failed';
export type ActorNameResolution =
  | 'cli-flag'
  | 'git-config'
  | 'environment'
  | 'unknown'
  | 'mcp-client';
export type ActorTypeResolution = 'cli-default' | 'cli-agent-flag' | 'mcp-default';

export type SourceToolName =
  | 'notch-cli'
  | 'notch-mcp'
  | 'claude'
  | 'claude-code'
  | 'codex'
  | 'cursor'
  | 'chatgpt'
  | 'chatgpt-desktop'
  | 'other';

export type SourceLinkKind = 'file' | 'url' | 'commit' | 'issue' | 'record' | 'command' | 'repo';

export type Actor = {
  actorType: ActorType;
  name: string;
  actorSlug?: string;
  modelProvider?: string;
  model?: string;
};

export type SourceTool = {
  name: SourceToolName;
  version?: string;
  client?: string;
};

export type SourceLink = {
  kind: SourceLinkKind;
  path?: string;
  url?: string;
  recordId?: string;
  commit?: string;
  repoRoot?: string;
  repoName?: string;
  label?: string;
  lastVerifiedAt?: string;
};

export type PacketArtifact = {
  path: string;
  sha256: string;
  bytes: number;
  purpose: PacketArtifactPurpose;
};

export type RecordMeta = {
  id: string;
  schemaVersion: SchemaVersion;
  recordType: RecordType;
  status: RecordStatus;
  createdAt: string;
  updatedAt?: string;
  createdBy: Actor;
  sourceTool: SourceTool;
  tags: string[];
  sourceLinks: SourceLink[];
  reviewStatus: ReviewStatus;
};

export type RedactionRule = {
  kind: 'regex';
  value: string;
  flags?: string;
};

export type NotchConfig = {
  schemaVersion: SchemaVersion;
  project: {
    name: string;
    root: string;
    defaultBranch?: string;
  };
  store: {
    path: '.notch';
    recordFormat: 'markdown-yaml';
    index: {
      enabled: boolean;
      engine: 'file-scan';
    };
  };
  privacy: {
    telemetry: false;
    redactPatterns: RedactionRule[];
    secretScan: boolean;
    highEntropySecretScan: boolean;
  };
  defaults: {
    allowedMcpWriteTools: string[];
  };
  artifacts?: {
    maxArtifactBytes?: number;
    maxPacketBytes?: number;
    scanTextExtensions?: string[];
  };
  continuation?: {
    mode: ContinuationMode;
    sensitivity: Sensitivity;
    streamOverride?: string;
    semanticTriggers: string[];
    claudeCode: {
      events: ClaudeCodeContinuationEvent[];
    };
  };
};

export type ProjectBrief = RecordMeta & {
  recordType: 'project_brief';
  projectName: string;
  currentFocus: string[];
  activeConstraints: string[];
  recentActivity: string[];
  openThreads: string[];
  warnings: string[];
};

export type NotchBrief = RecordMeta & {
  recordType: 'brief';
  title: string;
  targetAgent: string;
  goal: string;
  scope: {
    topics: string[];
    files: string[];
    timeframe?: string;
  };
  exclusions: string[];
  relevantFiles: SourceLink[];
  designBasis: string;
  priorReasoningSummary: string;
  constraints: string[];
  recommendedNextSteps: string[];
};

export type PacketRecordRef = {
  id: string;
  recordType: Exclude<RecordType, 'config' | 'packet'>;
  title: string;
  path: string;
  summary?: string;
};

export type NotchPacket = Omit<RecordMeta, 'recordType' | 'status'> & {
  recordType: 'packet';
  status: PacketStatus;
  title: string;
  purpose: PacketPurpose;
  sensitivity: Sensitivity;
  transferStatus: TransferStatus;
  origin: {
    projectName: string;
    storePath: string;
    repoRoot?: string;
    repoRemote?: string;
    commit?: string;
    branch?: string;
  };
  recipient: {
    targetAgent?: string;
    targetPerson?: string;
    targetRepo?: string;
    targetStore?: string;
  };
  summary: string;
  nextSteps?: string;
  artifacts?: PacketArtifact[];
  supersedes?: string;
  replyTo?: string;
  replyType?: ReplyType;
  privateContextSummary?: string;
  includedRecords: PacketRecordRef[];
  includedSourceLinks: SourceLink[];
  importNotes?: string;
  importedFrom?: string;
  importedAt?: string;
};

export type AuditEntry = {
  schemaVersion: SchemaVersion;
  at: string;
  operation: AuditOperation;
  result: AuditResult;
  actor: Actor;
  actorNameResolution: ActorNameResolution;
  actorTypeResolution: ActorTypeResolution;
  sourceTool: SourceTool;
  recordType?: RecordType;
  recordId?: string;
  recordPath?: string;
  importedFrom?: string;
  path?: string;
  reason?: string;
  supersedes?: string;
  errorCode?: string;
};

export type ProjectStatusSummary = {
  schemaVersion: SchemaVersion;
  generatedAt: string;
  projectName: string;
  storePath: string;
  counts: {
    targetedBriefs: number;
    inboxPackets: number;
    outboxPackets: number;
    privateSeedPackets: number;
    validationIssues: number;
  };
  recentInboxPackets: Array<{
    id: string;
    title: string;
    originProject?: string;
    importedAt?: string;
    summary: string;
  }>;
  openBriefs: Array<{ id: string; title: string; targetAgent: string; tags: string[] }>;
  warnings: import('./errors.js').NotchError[];
};
