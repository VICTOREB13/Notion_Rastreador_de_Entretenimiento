"use client";

import React from "react";
import { Sparkles, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { cn } from "@/lib/utils";

export interface AiModelConfigFormProps {
  selectedPreset: string;
  onSelectPreset: (preset: string) => void;
  customModelName: string;
  onChangeCustomModelName: (name: string) => void;
  activeModel: string;
  apiKey: string;
  onChangeApiKey: (key: string) => void;
  showApiKey: boolean;
  onToggleShowApiKey: () => void;
  isConfigured?: boolean;
  temperature: number;
  onChangeTemperature: (temp: number) => void;
  testResult: { success: boolean; message: string } | null;
  saveError: string | null;
  modelOptions: Array<{
    value: string;
    label: string;
    description: string;
    badge: string;
  }>;
}

export function AiModelConfigForm({
  selectedPreset,
  onSelectPreset,
  customModelName,
  onChangeCustomModelName,
  activeModel,
  apiKey,
  onChangeApiKey,
  showApiKey,
  onToggleShowApiKey,
  isConfigured,
  temperature,
  onChangeTemperature,
  testResult,
  saveError,
  modelOptions,
}: AiModelConfigFormProps) {
  return (
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
          onChange={onSelectPreset}
          options={modelOptions}
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
            onChange={(e) => onChangeCustomModelName(e.target.value)}
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
          {isConfigured && (
            <span className="text-[11px] font-mono text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Configurada en servidor
            </span>
          )}
        </div>
        <div className="relative">
          <input
            type={showApiKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => onChangeApiKey(e.target.value)}
            placeholder={
              isConfigured
                ? "•••••••••••••••••••••••• (dejar en blanco para conservar)"
                : "AIzaSy..."
            }
            className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 font-mono text-xs focus:outline-hidden focus:border-rose-500/60"
          />
          <button
            type="button"
            onClick={onToggleShowApiKey}
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
          onChange={(e) => onChangeTemperature(parseFloat(e.target.value))}
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
  );
}
