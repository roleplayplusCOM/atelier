/**
 * Live log pane that sits INSIDE the build dialog, next to the wizard — so you
 * can see that checking/building is still doing something without opening a
 * second window.
 *
 * It shows only what happened since it mounted (the ring buffer's history is
 * noise here) and renders through the same plain-language layer as the log
 * window. The full console is one click away for anything deeper.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { humanizeEntry } from "@/lib/log-humanize";
import {
  levelRank,
  openLogWindow,
  startLogStream,
  stopLogStream,
  useLogConsoleStore,
} from "@/lib/stores/log-console-store";

const LEVEL_STYLES: Record<string, string> = {
  TRACE: "text-faint",
  DEBUG: "text-faint",
  INFO: "text-grey",
  WARN: "text-amber-300",
  ERROR: "text-red-400",
};

function time(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(
    d.getSeconds(),
  ).padStart(2, "0")}`;
}

export function BuildLogPane({
  className,
  since: sinceProp,
}: {
  className?: string;
  /**
   * Cutoff timestamp. MUST come from the session (not mount time): the screen
   * unmounts whenever the user jumps to the workbench, and a mount-scoped
   * cutoff would hide everything the running job logged while they were away.
   */
  since?: number;
}) {
  const { t } = useTranslation("build");
  const { t: tRaw, i18n } = useTranslation("logtext");
  const tl = tRaw as unknown as (key: string, vars?: Record<string, unknown>) => string;

  const entries = useLogConsoleStore((s) => s.entries);
  const [mountedAt] = useState(() => Date.now());
  const since = sinceProp ?? mountedAt;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void startLogStream();
    return () => {
      void stopLogStream();
    };
  }, []);

  const rows = useMemo(() => {
    const min = levelRank("DEBUG");
    return entries
      .filter((e) => e.ts >= since && levelRank(e.level) >= min)
      .map((entry) => ({ entry, human: humanizeEntry(entry, tl, i18n.language) }))
      .filter((r) => r.human.kind !== "noise");
  }, [entries, since, tl, i18n.language]);

  // Always stick to the newest line — this pane exists to show liveness.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [rows]);

  return (
    <div className={cn("flex min-h-0 flex-col rounded-[14px] border border-line bg-black/30", className)}>
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-1.5">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
        </span>
        <span className="text-[11px] font-medium text-grey">{t("log.title")}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 w-6 shrink-0 p-0 text-faint hover:text-foreground"
              onClick={() => openLogWindow()}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("log.openWindow")}</TooltipContent>
        </Tooltip>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 select-text overflow-y-auto px-3 py-2">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-faint">{t("log.waiting")}</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {rows.map(({ entry, human }, i) => (
              <div key={`${entry.ts}-${i}`} className="flex gap-2 text-[11px] leading-[1.45]">
                <span className="shrink-0 font-mono text-faint">{time(entry.ts)}</span>
                <span
                  className={cn("min-w-0 break-words", LEVEL_STYLES[entry.level] ?? "text-grey")}
                  title={entry.message}
                >
                  {human.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
