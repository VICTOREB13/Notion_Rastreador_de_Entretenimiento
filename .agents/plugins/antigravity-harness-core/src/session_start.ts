import { TelemetryDB } from "./telemetry_db";

export interface SessionStartPayload {
  conversationId?: string;
  workspacePaths?: string[];
  transcriptPath?: string;
  artifactDirectoryPath?: string;
  modelName?: string;
  [key: string]: any;
}

export function handleSessionStart(payload: SessionStartPayload): Record<string, any> {
  try {
    const telemetry = new TelemetryDB();
    telemetry.close();
  } catch {}

  return {
    injectSteps: [
      {
        ephemeralMessage: "🚀 [Harness³ Core] Initialized. In-flight overwrite, telemetry & quality gates active.",
      },
    ],
  };
}

if (import.meta.main) {
  let inputData = "";
  process.stdin.setEncoding("utf-8");

  process.stdin.on("data", (chunk) => {
    inputData += chunk;
  });

  process.stdin.on("end", () => {
    try {
      const payload: SessionStartPayload = inputData.trim() ? JSON.parse(inputData) : {};
      const res = handleSessionStart(payload);
      process.stdout.write(JSON.stringify(res));
    } catch {
      process.stdout.write(JSON.stringify({}));
    }
    process.exit(0);
  });
}
