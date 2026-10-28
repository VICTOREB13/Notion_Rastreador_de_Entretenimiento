"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Server,
  Database,
  Gamepad2,
  Film,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { DialogModal } from "@/components/ui/DialogModal";
import { MorphButton } from "@/components/ui/MorphButton";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  useSystemSettingsQuery,
  useAiSettingsQuery,
  useUpdateAiSettingsMutation,
  useTestAiConnectionMutation,
  useTriggerSyncMutation,
} from "@/lib/hooks";

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

  const formatUptime = (seconds?: number) => {
    if (!seconds) return "0m";
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  };

  const services = [
    { label: "Daemon API", sub: "Hono Core", icon: <Activity className="w-4 h-4 text-emerald-500" />, ok: true },
    { label: "Notion SSoT", sub: telemetry?.isNotionConnected ? "Conectado" : "Offline", icon: <Database className="w-4 h-4 text-rose-500" />, ok: telemetry?.isNotionConnected },
    { label: "Steam Live", sub: telemetry?.isSteamConnected ? "Conectado" : "Offline", icon: <Gamepad2 className="w-4 h-4 text-sky-500" />, ok: telemetry?.isSteamConnected },
    { label: "RAWG API", sub: telemetry?.isRawgConnected ? "Conectado" : "Cuota Preservada", icon: <Gamepad2 className="w-4 h-4 text-amber-500" />, ok: telemetry?.isRawgConnected },
    { label: "TMDB Cine", sub: telemetry?.isTmdbConnected ? "Conectado" : "Offline", icon: <Film className="w-4 h-4 text-purple-500" />, ok: telemetry?.isTmdbConnected },
    { label: "Gemini IA", sub: telemetry?.activeModel || "gemini-2.0-flash", icon: <Cpu className="w-4 h-4 text-rose-500" />, ok: telemetry?.isGeminiConnected },
  ];

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
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-rose-500" /> Estado de Conexiones & Servicios
            </h4>
            <span className="text-[10px] font-mono text-zinc-400">
              Uptime: {formatUptime(telemetry?.uptime)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {services.map((svc) => (
              <div
                key={svc.label}
                className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {svc.icon}
                  <div className="truncate">
                    <span className="block font-semibold text-zinc-800 dark:text-zinc-200 text-[11px] truncate">{svc.label}</span>
                    <span className="text-[10px] text-zinc-500 font-mono truncate">{svc.sub}</span>
                  </div>
                </div>
                <span
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0 shadow-xs",
                    svc.ok ? "bg-emerald-500 shadow-emerald-500/50" : "bg-zinc-400"
                  )}
                />
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 2: Kinetic Manual Sync Bar */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 block">Sincronización Steam ➔ Notion</span>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Emparejamiento heurístico de horas, auto-culminación HLTB y preservación de cuota RAWG (0 llamadas si ya tiene portada).
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <MorphButton
              variant="primary"
              size="md"
              isLoading={syncMutation.isPending}
              isSuccess={Boolean(syncSuccessMsg)}
              successText={syncSuccessMsg || "¡Sincronizado!"}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              text="Sincronizar Steam hacia Notion"
              onClick={handleTriggerSync}
              className="cursor-pointer"
            />
          </div>
        </div>

        {/* SECTION 3: Dynamic Model Selection (Fase 5) with Canonical CustomSelect */}
        <div className="space-y-4 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-rose-500" /> Pipeline de IA & Modelos Flexibles
            </h4>
            <span className="text-[11px] font-mono text-rose-500 font-semibold truncate max-w-[200px]">
              Activo: {activeModel}
            </span>
          </div>

          <div>
            <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
              Modelo Gemini & Argon
            </label>
            <CustomSelect
              value={selectedPreset}
              onChange={(val) => setSelectedPreset(val)}
              options={MODEL_OPTIONS}
              placeholder="Seleccionar modelo..."
              ariaLabel="Selector de Modelo de Inteligencia Artificial"
            />
          </div>

          {selectedPreset === "custom" && (
            <div className="animate-in fade-in duration-150">
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                Nombre del Modelo Personalizado o Serie Argon
              </label>
              <input
                type="text"
                value={customModelName}
                onChange={(e) => setCustomModelName(e.target.value)}
                placeholder="ej: argon-experimental, gemini-2.0-flash-thinking-exp..."
                className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 font-mono text-xs focus:outline-hidden focus:border-rose-500/60"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Ingresa cualquier identificador de modelo válido compatible con la API de Gemini o el backend.
              </p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                Custom Gemini API Key
              </label>
              {aiSettings?.geminiConfigured && (
                <span className="text-[11px] font-mono text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Configurada en servidor
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  aiSettings?.geminiConfigured
                    ? "•••••••••••••••••••••••• (dejar en blanco para conservar)"
                    : "AIzaSy..."
                }
                className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 font-mono text-xs focus:outline-hidden focus:border-rose-500/60"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-zinc-700 dark:text-zinc-300">Temperatura Creativa</label>
              <span className="font-mono text-rose-500 font-bold">{temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer"
            />
          </div>

          {testResult && (
            <div
              className={cn(
                "p-3 rounded-xl border flex items-center gap-2",
                testResult.success
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                  : "bg-red-50 dark:bg-red-950/40 border-red-500/30 text-red-800 dark:text-red-300"
              )}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              )}
              <span className="text-[11px] leading-snug">{testResult.message}</span>
            </div>
          )}

          {saveError && (
            <div className="p-3 rounded-xl border bg-red-50 dark:bg-red-950/40 border-red-500/30 text-red-800 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span className="text-[11px] leading-snug">{saveError}</span>
            </div>
          )}
        </div>

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
