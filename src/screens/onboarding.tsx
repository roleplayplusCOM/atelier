/**
 * First-run setup wizard — shown once before the login gate when the app has
 * never been configured. Walks through the same settings the user would
 * otherwise hunt for in Settings, step by step: the sync server address (with
 * a live health check against the API), the GTA V install folder, and the
 * live-log feature. Completing it sets the `onboardingDone` flag.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  ChevronLeft,
  Cloud,
  FolderOpen,
  Globe,
  HardDrive,
  Loader2,
  ScrollText,
  ServerCog,
  X,
} from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import atelierLogo from "@/assets/atelier-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { GateShell } from "@/screens/login";
import i18n, { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { changeLanguage } from "@/lib/i18n/language";
import { checkApiHealth } from "@/lib/sync/api-client";
import { pushGtaPathToSidecar } from "@/lib/sidecar/gta-path";
import {
  DEFAULT_API_URL,
  getApiUrl,
  getGtaPath,
  getLogConsoleEnabled,
  setGtaPath,
  setLogConsoleEnabled,
  setOnboardingDone,
} from "@/lib/settings";
import { useAuthStore } from "@/lib/stores/auth-store";
import { openLogWindow, useLogConsoleStore } from "@/lib/stores/log-console-store";
import { cn } from "@/lib/utils";

type Step = { id: string; title: string };

const STEPS: readonly Step[] = [
  { id: "language", title: "Language" },
  { id: "mode", title: "Mode" },
  { id: "server", title: "Server" },
  { id: "gta", title: "GTA V" },
  { id: "logs", title: "Logs" },
];

type HealthState = "idle" | "checking" | "ok" | "fail";

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function OnboardingWizard({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  /** When set (re-run from Settings), shows a cancel exit on step 1. */
  onCancel?: () => void;
}) {
  const { t } = useTranslation("onboarding");
  const setApiUrl = useAuthStore((s) => s.setApiUrl);
  const appMode = useAuthStore((s) => s.appMode);
  const setAppMode = useAuthStore((s) => s.setAppMode);
  const [stepIdx, setStepIdx] = useState(0);

  // Solo mode is fully local, so the sync-server step is dropped from the flow.
  const steps = STEPS.filter((s) => s.id !== "server" || appMode === "cloud");
  // Re-render on language switch so the highlighted option stays in sync.
  const [currentLang, setCurrentLang] = useState(i18n.language);

  // Step 1 — server address + health check.
  const [apiDraft, setApiDraft] = useState(DEFAULT_API_URL);
  const [health, setHealth] = useState<HealthState>("idle");
  const [healthMsg, setHealthMsg] = useState<string | null>(null);

  // Step 2 — GTA path.
  const [gtaPath, setGtaPathState] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  // Step 3 — live log console.
  const [logEnabled, setLogEnabled] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    void getApiUrl().then(setApiDraft).catch(() => {});
    void getGtaPath().then(setGtaPathState).catch(() => {});
    void getLogConsoleEnabled().then(setLogEnabled).catch(() => {});
  }, []);

  const runHealthCheck = async () => {
    setHealth("checking");
    setHealthMsg(null);
    try {
      const { version } = await checkApiHealth(apiDraft);
      setHealth("ok");
      setHealthMsg(
        version ? t("server.apiRunningHere", { version }) : t("server.apiReachable"),
      );
    } catch (e) {
      setHealth("fail");
      setHealthMsg(errorMessage(e));
    }
  };

  const pickGtaPath = async () => {
    setPicking(true);
    try {
      const selected = await openDialog({
        directory: true,
        title: t("gta.pickerTitle"),
      });
      if (typeof selected === "string") {
        setGtaPathState(selected);
        await setGtaPath(selected);
        const ready = await pushGtaPathToSidecar(selected);
        toast[ready ? "success" : "warning"](t("gta.pathSaved"), {
          description: ready
            ? t("gta.pathSavedReady")
            : t("gta.pathSavedUnverified"),
        });
      }
    } catch (e) {
      toast.error(t("gta.pickFailed"), { description: errorMessage(e) });
    } finally {
      setPicking(false);
    }
  };

  const next = async () => {
    // Persist the server address before leaving the server step (cloud only).
    if (steps[stepIdx].id === "server") {
      await setApiUrl(apiDraft).catch(() => {});
    }
    if (stepIdx < steps.length - 1) setStepIdx((i) => i + 1);
  };

  const finish = async () => {
    setFinishing(true);
    try {
      await setLogConsoleEnabled(logEnabled);
      useLogConsoleStore.getState().setEnabled(logEnabled);
      if (logEnabled) openLogWindow();
      await setOnboardingDone(true);
      onDone();
    } catch (e) {
      toast.error(t("finishFailed"), {
        description: errorMessage(e),
      });
      setFinishing(false);
    }
  };

  const step = steps[stepIdx];
  const welcomeWords = t("welcomeTitle").split(" ");
  const welcomeTail = welcomeWords.length > 1 ? (welcomeWords.pop() as string) : "";
  const welcomeHead = welcomeWords.join(" ");
  const isLast = stepIdx === steps.length - 1;

  return (
    <GateShell>
      <div className="flex h-full items-center justify-center px-8">
        <div className="animate-fade-in-up grid w-full max-w-[860px] grid-cols-[280px_minmax(0,1fr)] overflow-hidden rounded-[28px] bg-card shadow-[var(--shadow-l)]">
          {/* Brand panel: always dark, like the device in the Roleplay+ look. */}
          <aside className="relative flex flex-col overflow-hidden bg-[#0d0d10] p-8 text-white">
            <span aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#ff8a1f]/40 blur-3xl" />
            <span aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-[#f4456b]/35 blur-3xl" />
            <img src={atelierLogo} alt="" className="relative h-11 w-11" draggable={false} />
            <h1 className="relative mt-6 text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">
              {welcomeHead}
              {welcomeTail && <> <span className="grad">{welcomeTail}</span></>}
            </h1>
            <p className="relative mt-2 text-sm text-white/60">{t("welcomeSubtitle")}</p>
            <ol className="relative mt-auto flex flex-col gap-3 pt-10">
              {steps.map((st, i) => (
                <li key={st.id} className="flex items-center gap-3 text-sm">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                      i < stepIdx && "bg-white/15 text-white",
                      i === stepIdx && "bg-[image:var(--grad)] text-white",
                      i > stepIdx && "bg-white/8 text-white/40",
                    )}
                  >
                    {i < stepIdx ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={cn(i === stepIdx ? "font-semibold text-white" : "text-white/45")}>
                    {t(`steps.${st.id}`, st.title)}
                  </span>
                </li>
              ))}
            </ol>
          </aside>

          <div className="flex min-h-[460px] flex-col p-9">
          <div className="min-h-[184px] flex-1">
            {step.id === "language" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-foreground">
                  <Globe className="h-4 w-4 text-brand" />
                  <span className="text-sm font-medium">{t("language.title")}</span>
                </div>
                <p className="text-sm text-grey">{t("language.description")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const active = currentLang === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          void changeLanguage(lang.code).then(() =>
                            setCurrentLang(lang.code),
                          );
                        }}
                        className={cn(
                          "flex items-center justify-between rounded-[14px] border px-3 py-2.5 text-sm transition-colors",
                          active
                            ? "border-brand bg-brand/15 text-foreground"
                            : "border-line bg-fill text-grey hover:bg-fill-2",
                        )}
                      >
                        <span>{lang.label}</span>
                        {active && <Check className="h-4 w-4 shrink-0 text-brand" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step.id === "mode" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-foreground">
                  <Cloud className="h-4 w-4 text-brand" />
                  <span className="text-sm font-medium">{t("mode.title")}</span>
                </div>
                <p className="text-sm text-grey">{t("mode.description")}</p>
                <div className="flex flex-col gap-2">
                  {(["solo", "cloud"] as const).map((m) => {
                    const active = appMode === m;
                    const Icon = m === "solo" ? HardDrive : Cloud;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => void setAppMode(m)}
                        className={cn(
                          "flex items-start gap-3 rounded-[14px] border px-3 py-3 text-left transition-colors",
                          active
                            ? "border-brand bg-brand/15"
                            : "border-line bg-fill hover:bg-fill-2",
                        )}
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">
                            {t(`mode.${m}.title`)}
                          </span>
                          <span className="mt-0.5 block text-xs text-grey">
                            {t(`mode.${m}.description`)}
                          </span>
                        </span>
                        {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step.id === "server" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-foreground">
                  <ServerCog className="h-4 w-4 text-brand" />
                  <span className="text-sm font-medium">{t("server.title")}</span>
                </div>
                <p className="text-sm text-grey">{t("server.description")}</p>
                <div className="flex gap-2">
                  <Input
                    value={apiDraft}
                    onChange={(e) => {
                      setApiDraft(e.target.value);
                      setHealth("idle");
                      setHealthMsg(null);
                    }}
                    placeholder={DEFAULT_API_URL}
                    className="border-line bg-fill text-foreground"
                  />
                  <Button
                    variant="outline"
                    disabled={health === "checking"}
                    onClick={() => void runHealthCheck()}
                  >
                    {health === "checking" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t("server.check")
                    )}
                  </Button>
                </div>
                {healthMsg && (
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-[16px] px-3 py-2 text-sm",
                      health === "ok" && "bg-emerald-500/10 text-emerald-300",
                      health === "fail" && "bg-red-500/10 text-red-300",
                    )}
                  >
                    {health === "ok" ? (
                      <Check className="h-4 w-4 shrink-0" />
                    ) : (
                      <X className="h-4 w-4 shrink-0" />
                    )}
                    <span>{healthMsg}</span>
                  </div>
                )}
              </div>
            )}

            {step.id === "gta" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-foreground">
                  <FolderOpen className="h-4 w-4 text-brand" />
                  <span className="text-sm font-medium">{t("gta.title")}</span>
                </div>
                <p className="text-sm text-grey">{t("gta.description")}</p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={gtaPath ?? ""}
                    placeholder={t("gta.noPathYet")}
                    className="border-line bg-fill text-foreground"
                  />
                  <Button variant="outline" disabled={picking} onClick={() => void pickGtaPath()}>
                    <FolderOpen className="h-4 w-4" />
                    {t("gta.browse")}
                  </Button>
                </div>
                {gtaPath && (
                  <div className="flex items-center gap-2 rounded-[16px] bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>{t("gta.directorySet")}</span>
                  </div>
                )}
              </div>
            )}

            {step.id === "logs" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-foreground">
                  <ScrollText className="h-4 w-4 text-brand" />
                  <span className="text-sm font-medium">{t("logs.title")}</span>
                </div>
                <p className="text-sm text-grey">{t("logs.description")}</p>
                <div className="flex items-center justify-between gap-4 rounded-[14px] bg-fill px-3 py-2.5">
                  <span className="text-sm text-foreground">{t("logs.enableWindow")}</span>
                  <Switch checked={logEnabled} onCheckedChange={setLogEnabled} />
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between pt-2">
            {stepIdx > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                {t("common:back")}
              </Button>
            ) : onCancel ? (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                {t("common:cancel")}
              </Button>
            ) : (
              <span />
            )}

            {isLast ? (
              <Button
                disabled={finishing}
                size="lg"
                onClick={() => void finish()}
              >
                {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : t("finish")}
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => void next()}
              >
                {t("common:next")}
              </Button>
            )}
          </div>
        </div>
          </div>
      </div>
    </GateShell>
  );
}
