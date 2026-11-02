"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import { MorphButton } from "@/components/ui/MorphButton";

export interface KineticManualSyncCardProps {
  title?: string;
  description?: string;
  buttonText?: string;
  badge?: React.ReactNode;
  isPending: boolean;
  successMsg: string | null;
  onTriggerSync: () => void;
}

export function KineticManualSyncCard({
  title = "Sincronización Steam ➔ Notion",
  description = "Emparejamiento heurístico de horas, auto-culminación HLTB y preservación de cuota RAWG (0 llamadas si ya tiene portada).",
  buttonText = "Sincronizar Steam hacia Notion",
  badge,
  isPending,
  successMsg,
  onTriggerSync,
}: KineticManualSyncCardProps) {
  return (
    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-zinc-900 dark:text-zinc-100 block">{title}</span>
          {badge}
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
          {description}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <MorphButton
          variant="primary"
          size="md"
          isLoading={isPending}
          isSuccess={Boolean(successMsg)}
          successText={successMsg || "¡Sincronizado!"}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
          text={buttonText}
          onClick={onTriggerSync}
          className="cursor-pointer"
        />
      </div>
    </div>
  );
}
