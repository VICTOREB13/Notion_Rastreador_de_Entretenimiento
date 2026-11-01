import packageJson from "../../package.json";

/**
 * Single Source of Truth (SSoT) para la versión de la aplicación.
 * Prioriza la variable inyectada en tiempo de compilación o runtime,
 * o extrae dinámicamente la versión declarada en apps/web/package.json.
 */
export const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION || ("v" + packageJson.version);
