export type RunStatus = "queued" | "running" | "completed" | "failed" | "stopped";

export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface PipelineStep {
  number: number;
  name: string;
  label: string;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  durationSeconds?: number;
  costUsd?: number;
  verifyAttempt?: number;
}

export interface PipelineRun {
  id: string;
  category: string;
  timestamp: string;
  startedAt: string;
  completedAt?: string;
  status: RunStatus;
  buildSuccess?: boolean;
  currentStep: number;
  steps: PipelineStep[];
  totalCostUsd: number;
  workspace: string;
  hasProductSpec: boolean;
  hasReviewReport: boolean;
  appName?: string;
  deployStatus?: "not_started" | "deploying" | "deployed" | "failed";
  deployUrl?: string;
  githubRepoUrl?: string;
}

export interface RunArtifact {
  path: string;
  name: string;
  type: "file" | "directory";
  size?: number;
  extension?: string;
}

export interface LogLine {
  timestamp: string;
  message: string;
  type: "info" | "step" | "error" | "cost" | "success" | "separator";
}

export interface NewRunRequest {
  category: string;
}

export interface QueueItem {
  id: string;
  category: string;
  requestedAt: string;
}

export interface WebRunMeta {
  startedAt: string;
  startedBy: "web-ui" | "cli";
  category: string;
  runId: string;
  status: RunStatus;
  pid: number | null;
  completedAt?: string;
  exitCode?: number | null;
}

export interface SSEMessage {
  type: "initial" | "append" | "complete" | "error";
  content?: string;
  status?: RunStatus;
}

export interface RunStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  runningRuns: number;
  totalCostUsd: number;
  successRate: number;
}

export interface IdeaProposal {
  appName: string;
  tagline: string;
  description: string;
  features: string[];
  techStack: string[];
  targetAudience: string;
  monetization: string;
  uniqueValue: string;
}

export type IdeaStatus = "idle" | "generating" | "ready" | "approved" | "rejected" | "building";

export interface IdeaSession {
  id: string;
  category: string;
  status: IdeaStatus;
  idea: IdeaProposal | null;
  createdAt: string;
  approvedAt?: string;
  runId?: string;
}

export interface SettingsData {
  geminiApiKey?: string;
  githubToken?: string;
  githubOrg?: string;
  coolifyApiUrl?: string;
  coolifyApiToken?: string;
  coolifyServerId?: string;
}
