"use client";
import React, { useState, useEffect } from "react";
import {
  Sun,
  Moon,
  Monitor,
  Cpu,
  Sparkles,
  Download,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { DialogModal } from "@/components/ui/DialogModal";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  useSystemSettingsQuery,
  useTriggerSyncMutation,
  useBatchEnrichMutation,
} from "@/lib/hooks";
import { getBackupDownloadUrl } from "@/lib/api";
import { ServicesTelemetryGrid } from "./ServicesTelemetryGrid";
import { KineticManualSyncCard } from "./KineticManualSyncCard";

export interface TelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TelemetryModal({ isOpen, onClose }: TelemetryModalProps) {
  const { theme, setTheme } = useTheme();
  const { data: telemetry } = useSystemSettingsQuery();
  const syncMutation = useTriggerSyncMutation();
  const batchEnrichMutation = useBatchEnrichMutation();

  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);

  const [batchSuccessMsg, setBatchSuccessMsg] = useState<string | null>(null);
  const [batchErrorMsg, setBatchErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSyncSuccessMsg(null);
      setSyncErrorMsg(null);
      setBatchSuccessMsg(null);
      setBatchErrorMsg(null);
    }
  }, [isOpen]);

  const handleTriggerSync = async () => {
    setSyncSuccessMsg(null);
    setSyncErrorMsg(null);
    try {
      const res = await syncMutation.mutateAsync();
      const gamesCount =
        (res?.data?.games?.updatedNotion ?? 0) + (res?.data?.games?.createdNotion ?? 0);
      const moviesCount = res?.data?.movies?.moviesEnriched ?? 0;
      setSyncSuccessMsg(`¡Sincronizado! (${gamesCount} juegos, ${moviesCount} películas)`);
    } catch (err: any) {
      setSyncErrorMsg(err.message || "Error al sincronizar con Notion y Steam.");
    }
  };

  const handleTriggerBatchEnrich = async () => {
    setBatchSuccessMsg(null);
    setBatchErrorMsg(null);
    try {
      const res = await batchEnrichMutation.mutateAsync({
        limit: 15,
        delayMs: 800,
        targetType: "ALL",
        force: false,
      });
      setBatchSuccessMsg(
        `¡Enriquecimiento completado! Procesados: ${res.processed}, Éxitos: ${res.success}${
          res.errors > 0 ? `, Errores: ${res.errors}` : ""
        }`
      );
    } catch (err: any) {
      setBatchErrorMsg(err.message || "Error al procesar el lote de enriquecimiento IA.");
    }
  };

  const activeModel = telemetry?.activeModel || "gemini-2.5-flash";
  const isAiConnected = Boolean(telemetry?.isGeminiConnected);

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

        {/* SECTION 2: Kinetic Manual Sync Card */}
        <div className="space-y-1.5">
          <KineticManualSyncCard
            isPending={syncMutation.isPending}
            successMsg={syncSuccessMsg}
            onTriggerSync={handleTriggerSync}
          />
          {syncErrorMsg && (
            <p className="text-[11px] font-mono text-rose-500 px-2">{syncErrorMsg}</p>
          )}
        </div>

        {/* SECTION 3: Motor de IA Soberano (Showcase Público & Enriquecimiento Masivo) */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">
                  Motor de Inteligencia Artificial
                </h4>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Configuración soberana administrada desde variables de entorno del servidor (.env)
                </p>
              </div>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border",
                isAiConnected
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  isAiConnected ? "bg-emerald-500" : "bg-amber-500"
                )}
              />
              {isAiConnected ? "Operativo" : "En Espera"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
            <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800/80">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 block mb-0.5">
                Proveedor de Inferencia
              </span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                Google Gemini
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800/80">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 block mb-0.5">
                Modelo Activo en Servidor
              </span>
              <span className="font-bold text-rose-600 dark:text-rose-400 truncate block">
                {activeModel}
              </span>
            </div>
          </div>

          {/* Botón de Enriquecimiento Masivo en Lote */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 block text-xs">
                Enriquecimiento Masivo en Lote
              </span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Procesa secuencialmente títulos pendientes de análisis sin saturar cuota
              </span>
            </div>
            <button
              type="button"
              onClick={handleTriggerBatchEnrich}
              disabled={batchEnrichMutation.isPending || !isAiConnected}
              className={cn(
                "inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer shadow-xs",
                batchEnrichMutation.isPending
                  ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                  : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20 active:scale-95"
              )}
            >
              {batchEnrichMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Procesando lote...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analizar Lote Pendiente</span>
                </>
              )}
            </button>
          </div>

          {batchSuccessMsg && (
            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-mono">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{batchSuccessMsg}</span>
            </div>
          )}

          {batchErrorMsg && (
            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-mono">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{batchErrorMsg}</span>
            </div>
          )}
        </div>

        {/* SECTION 4: Respaldo y Snapshot de Base de Datos en un Clic */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">
                  Respaldo & Snapshot Local (SQLite)
                </h4>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Exporta una copia de seguridad íntegra de videojuegos, películas, sesiones y enriquecimientos
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Formato JSON estructurado con cabecera Content-Disposition para guardado directo en un clic.
            </span>
            <a
              href={getBackupDownloadUrl()}
              download="notion-entertainment-backup.json"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 hover:border-sky-500/30 text-zinc-900 dark:text-white shadow-xs hover:text-sky-600 dark:hover:text-sky-400 transition-colors shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-sky-500" />
              <span>Descargar Respaldo JSON</span>
            </a>
          </div>
        </div>

        {/* SECTION 5: Apariencia & Modo (Dark, Light, System) */}
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

        {/* Action Buttons: Botón limpio y elegante de Cerrar */}
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 shadow-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </DialogModal>
  );
}

export default TelemetryModal;
