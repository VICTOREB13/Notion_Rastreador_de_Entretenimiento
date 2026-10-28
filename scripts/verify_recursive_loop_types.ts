export type DefectType = "Harness Defect" | "Code Defect" | "Clean Execution";

export interface FailureSignal {
  error: string;
  tool?: string;
  stepContent?: string;
  breakerTriggered?: boolean;
  loopDetected?: boolean;
  consecutiveFails?: number;
}

export interface TaskContext {
  id: string;
  skill: string;
  description: string;
  pitfall: string;
  requiredHeuristicPattern: RegExp;
}

export interface CycleStepTrace {
  step: number;
  phase: string;
  status: "FAIL" | "PASS" | "OPTIMIZED";
  details: string;
  metadata?: Record<string, any>;
}

export interface RecursiveLoopResult {
  success: boolean;
  task: TaskContext;
  cycleTraces: CycleStepTrace[];
  initialClassification: DefectType;
  injectedRule: string;
  updatedHeuristicsCount: number;
  validationPassed: boolean;
  finalExecutionPassed: boolean;
}

export interface AutoHealParams {
  tool: string;
  error?: string;
  stepContent?: string;
  consecutiveFails?: number;
  breakerBlocked?: boolean;
  breakerReason?: string;
  skill?: string;
  customPath?: string;
  ruleSuggestion?: string;
  currentDate?: string;
}

export interface AutoHealResult {
  triggered: boolean;
  defectType: DefectType;
  healed: boolean;
  skill: string;
  injectedRule: string | null;
  evictedRule: string | null;
  filePath: string;
  feedbackMessage: string;
  alreadyPresent?: boolean;
}
