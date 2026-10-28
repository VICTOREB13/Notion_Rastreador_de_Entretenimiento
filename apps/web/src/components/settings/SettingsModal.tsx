"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, Key, CheckCircle2, AlertCircle, Eye, EyeOff, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAiSettingsQuery,
  useUpdateAiSettingsMutation,
  useTestAiConnectionMutation,
} from "@/lib/hooks";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { data: settings, isLoading } = useAiSettingsQuery();
  const updateMutation = useUpdateAiSettingsMutation();
  const testMutation = useTestAiConnectionMutation();

  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(0.4);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setProvider(settings.activeProvider || "gemini");
      setModel(settings.selectedModel || "gemini-2.5-flash");
      setTemperature(settings.temperature ?? 0.4);
    }
  }, [settings]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      setSaveError(null);
      setTestResult(null);
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTestResult(null);
    try {
      const res = await testMutation.mutateAsync({
        apiKey: apiKey || undefined,
        model,
      });
      if (res.connected) {
        setTestResult({
          success: true,
          message: `Conexión exitosa con ${model} vía Gemini API.`,
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

  const handleSave = async () => {
    setSaveError(null);
    try {
      await updateMutation.mutateAsync({
        activeProvider: provider as any,
        selectedModel: model,
        temperature,
        geminiApiKey: apiKey || undefined,
      });
      onClose();
    } catch (err: any) {
      setSaveError(err.message || "Error al guardar la configuración de IA.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#111113] border border-white/10 rounded-2xl shadow-floating text-zinc-100 p-6 sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Cpu className="w-5 h-5 text-rose-400" />
          <h2 className="text-xl font-bold tracking-tight text-white">Configuración de IA</h2>
        </div>
        <p className="text-xs text-zinc-400 mb-6">
          Ajusta los modelos de lenguaje y credenciales del pipeline de enriquecimiento contextual.
        </p>

        <div className="space-y-4 text-xs">
          {/* Provider Selection */}
          <div>
            <label className="font-medium text-zinc-300 block mb-1.5">Proveedor Activo</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "gemini", label: "Google Gemini" },
                { id: "deepseek", label: "DeepSeek API" },
                { id: "groq", label: "Groq LPU" },
                { id: "ollama", label: "Ollama Local" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  className={cn(
                    "p-2.5 rounded-xl border text-left transition-all cursor-pointer font-medium",
                    provider === p.id
                      ? "bg-rose-500/10 border-rose-500/40 text-rose-300"
                      : "bg-zinc-900 border-white/5 text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="font-medium text-zinc-300 block mb-1.5">
              Modelo Gemini Seleccionado
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-zinc-200 focus:outline-hidden focus:border-rose-500/50"
            >
              <option value="gemini-2.5-flash">gemini-2.5-flash (Recomendado / Ultra rápido)</option>
              <option value="gemini-1.5-flash">gemini-1.5-flash (Versión estable previa)</option>
              <option value="gemini-1.5-pro">gemini-1.5-pro (Máximo razonamiento profundo)</option>
            </select>
          </div>

          {/* Custom API Key Input with Tester */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-medium text-zinc-300">Custom Gemini API Key</label>
              {settings?.geminiConfigured && (
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
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
                  settings?.geminiConfigured
                    ? "•••••••••••••••••••••••• (dejar en blanco para mantener)"
                    : "AIzaSy..."
                }
                className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-zinc-200 placeholder-zinc-500 font-mono text-xs focus:outline-hidden focus:border-rose-500/50"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Temperature Slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-zinc-300">Temperatura Creativa</label>
              <span className="font-mono text-rose-400 font-bold">{temperature.toFixed(2)}</span>
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

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={cn(
                "p-3 rounded-xl border flex items-center gap-2",
                testResult.success
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                  : "bg-red-950/40 border-red-500/30 text-red-300"
              )}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              )}
              <span className="text-[11px] leading-snug">{testResult.message}</span>
            </div>
          )}

          {saveError && (
            <div className="p-3 rounded-xl border bg-red-950/40 border-red-500/30 text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span className="text-[11px] leading-snug">{saveError}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTest}
            disabled={testMutation.isPending}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
          >
            {testMutation.isPending ? "Probando..." : "Probar Conexión"}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white text-xs font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {updateMutation.isPending ? "Guardando..." : "Guardar Ajustes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
