import { PIPELINE_STEPS } from "./constants";
import type { LogLine, PipelineStep, StepStatus } from "./types";

// Regex patterns matching orchestrator.sh output format
const TIMESTAMP_PREFIX = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (.*)/;
const STEP_HEADER = /ADIM (\d+)\/(\d+): (.+)/;
const STEP_START = /Ba\u015flat\u0131l\u0131yor: (.+)/;
const STEP_COMPLETE = /Tamamland\u0131: (.+) \((\d+) saniye\)/;
const COST_LINE = /Maliyet: \$(.+)/;
const BUILD_SUCCESS_LINE = /Build (\d+)\. denemede ba\u015far\u0131l\u0131!/;
const PIPELINE_COMPLETE = /PIPELINE TAMAMLANDI/;
const BUILD_STATUS_LINE = /Build Durumu:\s+(BA\u015eARILI|BA\u015eARISIZ)/;
const SEPARATOR_LINE = /^={3,}/;
const ERROR_LINE = /HATA:|UYARI:/;

export interface ParsedLog {
  lines: LogLine[];
  steps: PipelineStep[];
  currentStep: number;
  totalCostUsd: number;
  isComplete: boolean;
  buildSuccess: boolean | undefined;
  startedAt: string | undefined;
  completedAt: string | undefined;
}

export function parseLogContent(logContent: string): ParsedLog {
  const lines: LogLine[] = [];
  const stepMap = new Map<number, PipelineStep>();
  let currentStepNum = 0;
  let totalCost = 0;
  let isComplete = false;
  let buildSuccess: boolean | undefined;
  let startedAt: string | undefined;
  let completedAt: string | undefined;
  let activeStepName: string | undefined;

  // Initialize all steps as pending
  for (const stepDef of PIPELINE_STEPS) {
    stepMap.set(stepDef.number, {
      number: stepDef.number,
      name: stepDef.name,
      label: stepDef.label,
      status: "pending" as StepStatus,
    });
  }

  const rawLines = logContent.split("\n");

  for (const rawLine of rawLines) {
    if (!rawLine.trim()) continue;

    // Extract timestamp
    const tsMatch = rawLine.match(TIMESTAMP_PREFIX);
    const timestamp = tsMatch ? tsMatch[1] : "";
    const message = tsMatch ? tsMatch[2] : rawLine;

    // Track first timestamp as startedAt
    if (timestamp && !startedAt) {
      startedAt = timestamp;
    }

    // Determine line type
    let type: LogLine["type"] = "info";

    // Step header: "ADIM N/10: ..."
    const stepMatch = message.match(STEP_HEADER);
    if (stepMatch) {
      const stepNum = parseInt(stepMatch[1]);
      currentStepNum = stepNum;
      type = "step";

      // Mark previous step as completed if it was running
      for (const [, step] of stepMap) {
        if (step.status === "running") {
          step.status = "completed";
          step.completedAt = timestamp;
        }
      }

      // Mark current step as running
      const step = stepMap.get(stepNum);
      if (step) {
        step.status = "running";
        step.startedAt = timestamp;
      }
    }

    // Step start: "Baslatiliyor: ..."
    const startMatch = message.match(STEP_START);
    if (startMatch) {
      activeStepName = startMatch[1];
    }

    // Step complete: "Tamamlandi: X (Y saniye)"
    const completeMatch = message.match(STEP_COMPLETE);
    if (completeMatch) {
      const duration = parseInt(completeMatch[2]);
      const step = stepMap.get(currentStepNum);
      if (step) {
        step.durationSeconds = duration;
      }
    }

    // Cost: "Maliyet: $X.XX"
    const costMatch = message.match(COST_LINE);
    if (costMatch) {
      const cost = parseFloat(costMatch[1]);
      if (!isNaN(cost)) {
        totalCost += cost;
        const step = stepMap.get(currentStepNum);
        if (step) {
          step.costUsd = (step.costUsd || 0) + cost;
        }
      }
      type = "cost";
    }

    // Build success: "Build N. denemede basarili!"
    if (BUILD_SUCCESS_LINE.test(message)) {
      buildSuccess = true;
      type = "success";
      const match = message.match(BUILD_SUCCESS_LINE);
      if (match) {
        const step = stepMap.get(4); // verify_fix step
        if (step) {
          step.verifyAttempt = parseInt(match[1]);
        }
      }
    }

    // Build status line
    const buildStatusMatch = message.match(BUILD_STATUS_LINE);
    if (buildStatusMatch) {
      buildSuccess = buildStatusMatch[1] === "BA\u015eARILI";
    }

    // Pipeline complete
    if (PIPELINE_COMPLETE.test(message)) {
      isComplete = true;
      completedAt = timestamp;
      type = "success";

      // Mark all running steps as completed
      for (const [, step] of stepMap) {
        if (step.status === "running") {
          step.status = "completed";
          step.completedAt = timestamp;
        }
      }
    }

    // Separator lines
    if (SEPARATOR_LINE.test(message)) {
      type = "separator";
    }

    // Error/warning lines
    if (ERROR_LINE.test(message)) {
      type = "error";
    }

    lines.push({ timestamp, message, type });
  }

  // If pipeline is not complete but has steps, mark uncompleted steps
  if (!isComplete) {
    // The last running step stays as running
    // All steps after it stay as pending
  }

  const steps = Array.from(stepMap.values()).sort((a, b) => a.number - b.number);

  return {
    lines,
    steps,
    currentStep: currentStepNum,
    totalCostUsd: totalCost,
    isComplete,
    buildSuccess,
    startedAt,
    completedAt,
  };
}

export function getStepStatusFromLog(logContent: string, stepNumber: number): StepStatus {
  const parsed = parseLogContent(logContent);
  const step = parsed.steps.find((s) => s.number === stepNumber);
  return step?.status || "pending";
}
