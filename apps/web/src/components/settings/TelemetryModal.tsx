"use client";

import React, { useState, useEffect } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { DialogModal } from "@/components/ui/DialogModal";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  useSystemSettingsQuery,
  useAiSettingsQuery,
  useUpdateAiSettingsMutation,
  useTestAiConnectionMutation,
  useTriggerSyncMutation,
} from "@/lib/hooks";
import { ServicesTelemetryGrid } from "./ServicesTelemetryGrid";
import { KineticManualSyncCard } from "./KineticManualSyncCard";
import { AiModelConfigForm } from "./AiModelConfigForm";

export interface TelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MODEL_OPTIONS = [
  { value: "gemini-2.0-flash", label: "gemini-2.0-flash", description: "Predeterminado / Ultra rápido multimodal", badge: "2.0 Flash" },
  { value: "gemini-2.0-flash-lite", label: "gemini-2.0-flash-lite", description: "Ligero y económico", badge: "2.0 Lite" },
  { value: "gemini-2.0-pro-exp-02-05", label: "gemini-2.0-pro-exp-02-05", description: "Razonamiento profundo", badge: "2.0 Pro" },
  { value: "gemini-1.5-flash", label: "gemini-1.5-flash", description: "Versión previa de alta estabilidad", badge: "1.5 Flash" },
  { value: "gemini-1.5-pro", label: "gemini-1.5-pro", description: "Contexto masivo de 2M tokens", badge: "1.5 Pro" },
  { value: "custom", label: "Personalizado / Serie Argon", description: "Ingreso libre para modelos experimentales", badge: "Custom" },
];

export function TelemetryModal({ isOpen, onClose }: TelemetryModalProps) {
  const { theme, setTheme } = useTheme();
  const { data: telemetry } = useSystemSettingsQuery();
  const { data: aiSettings } = useAiSettingsQuery();
  const updateAiMutation = useUpdateAiSettingsMutation();
  const testAiMutation = useTestAiConnectionMutation();
  const syncMutation = useTriggerSyncMutation();

  const [provider, setProvider] = useState("gemini");
  const [selectedPreset, setSelectedPreset] = useState("gemini-2.0-flash");
  const [customModelName, setCustomModelName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(0.4);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (aiSettings) {
      setProvider(aiSettings.activeProvider || "gemini");
      const currentModel = aiSettings.selectedModel || "gemini-2.0-flash";
      const isKnown = MODEL_OPTIONS.some((m) => m.value === currentModel && m.value !== "custom");
      if (isKnown) {
        setSelectedPreset(currentModel);
        setCustomModelName("");
      } else {
        setSelectedPreset("custom");
        setCustomModelName(currentModel);
      }
      setTemperature(aiSettings.temperature ?? 0.4);
    }
  }, [aiSettings]);

  useEffect(() => {
    if (isOpen) {
      setSaveError(null);
      setTestResult(null);
      setSyncSuccessMsg(null);
    }
  }, [isOpen]);

  const activeModel =
    selectedPreset === "custom"
      ? customModelName.trim() || "gemini-2.0-flash"
      : selectedPreset;

  const handleTestConnection = async () => {
    setTestResult(null);
    try {
      const res = await testAiMutation.mutateAsync({
        apiKey: apiKey || undefined,
        model: activeModel,
      });
      if (res.connected) {
        setTestResult({
          success: true,
          message: `Conexión exitosa con ${activeModel} vía Gemini API.`,
        });
      } else {
        setTestResult({
          success: false,
          message: "No se pudo conectar con el modelo. Verifica tu API Key.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Error al verificar conexión con la API.",
      });
    }
  };

  const handleSaveSettings = async () => {
    setSaveError(null);
    try {
      await updateAiMutation.mutateAsync({
        activeProvider: provider as any,
        selectedModel: activeModel,
        temperature,
        geminiApiKey: apiKey || undefined,
      });
      onClose();
    } catch (err: any) {
      setSaveError(err.message || "Error al guardar la configuración de IA.");
    }
  };

  const handleTriggerSync = async () => {
    setSyncSuccessMsg(null);
    try {
      const res = await syncMutation.mutateAsync();
      const gamesCount = (res?.data?.games?.updatedNotion ?? 0) + (res?.data?.games?.createdNotion ?? 0);
      const moviesCount = res?.data?.movies?.moviesEnriched ?? 0;
      setSyncSuccessMsg(`¡Sincronizado! (${gamesCount} juegos, ${moviesCount} películas)`);
    } catch (err: any) {
      setSaveError(err.message || "Error al sincronizar con Notion y Steam.");
    }
  };

  return (
    <DialogModal
      isOpen={isOpen}
      onClose={onClose}
      title="Sistema & Telemetría"
      subtitle="Estado operativo de conexiones, sincronización bidireccional y modelos IA"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6 text-xs">
        {/* SECTION 1: Service Telemetry Grid */}
        <ServicesTelemetryGrid telemetry={telemetry} />

        {/* SECTION 2: Kinetic Manual Sync Bar */}
        <KineticManualSyncCard
          isPending={syncMutation.isPending}
          successMsg={syncSuccessMsg}
          onTriggerSync={handleTriggerSync}
        />

        {/* SECTION 3: Dynamic Model Selection */}
        <AiModelConfigForm
          selectedPreset={selectedPreset}
          onSelectPreset={setSelectedPreset}
          customModelName={customModelName}
          onChangeCustomModelName={setCustomModelName}
          activeModel={activeModel}
          apiKey={apiKey}
          onChangeApiKey={setApiKey}
          showApiKey={showApiKey}
          onToggleShowApiKey={() => setShowApiKey(!showApiKey)}
          isConfigured={aiSettings?.geminiConfigured}
          temperature={temperature}
          onChangeTemperature={setTemperature}
          testResult={testResult}
          saveError={saveError}
          modelOptions={MODEL_OPTIONS}
        />

        {/* SECTION 4: Apariencia & Modo (Dark, Light, System) */}
        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-rose-500" /> Apariencia & Tema
            </h4>
            <span className="text-[10px] font-mono text-zinc-400 capitalize">
              Modo activo: {theme}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "dark" as const, label: "Oscuro", icon: <Moon className="w-3.5 h-3.5" />, desc: "Obsidian Zinc" },
              { id: "light" as const, label: "Claro", icon: <Sun className="w-3.5 h-3.5" />, desc: "Crimson Crisp" },
              { id: "system" as const, label: "Sistema", icon: <Monitor className="w-3.5 h-3.5" />, desc: "Auto del SO" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={cn(
                  "p-2.5 rounded-xl border flex flex-col items-center gap-1 text-center transition-all cursor-pointer",
                  theme === t.id
                    ? "bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-600 dark:text-rose-400 font-semibold shadow-xs ring-1 ring-rose-500/20"
                    : "bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700"
                )}
              >
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  {t.icon}
                  <span>{t.label}</span>
                </div>
                <span className="text-[9px] text-zinc-400 dark:text-zinc-500">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testAiMutation.isPending}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            {testAiMutation.isPending ? "Verificando..." : "Probar Conexión"}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={updateAiMutation.isPending}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {updateAiMutation.isPending ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </div>
      </div>
    </DialogModal>
  );
}

export default TelemetryModal;
