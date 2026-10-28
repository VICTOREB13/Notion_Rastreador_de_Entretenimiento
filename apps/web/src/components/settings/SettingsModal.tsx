"use client";

import { TelemetryModal, type TelemetryModalProps } from "./TelemetryModal";

export type SettingsModalProps = TelemetryModalProps;

/**
 * SettingsModal is superseded by TelemetryModal ("Sistema & Telemetría"),
 * providing real-time daemon/service status, kinetic manual sync, and
 * dynamic Gemini 2.0 / Argon model selection.
 */
export function SettingsModal(props: SettingsModalProps) {
  return <TelemetryModal {...props} />;
}

export default SettingsModal;
