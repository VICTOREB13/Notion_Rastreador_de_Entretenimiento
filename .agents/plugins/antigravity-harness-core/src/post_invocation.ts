export function handlePostInvocation(payload: any): Record<string, any> {
  return { injectSteps: [] };
}

if (import.meta.main) {
  process.stdout.write(JSON.stringify({ injectSteps: [] }));
  process.exit(0);
}
