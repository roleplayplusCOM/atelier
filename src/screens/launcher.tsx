import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Hand,
  Shirt,
  Stamp,
  Store,
  Clock,
  Cloud,
  CloudOff,
  Folder,
  FolderOpen,
  Loader2,
  PackageOpen,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { NewProjectDialog } from "@/components/project/new-project-dialog";
import { RecoveryDialog } from "@/components/project/recovery-dialog";
import { OnlinePanel } from "@/components/launcher/online-panel";
import { GrzybeekCredits } from "@/components/shell/credits";
import {
  openProjectFromDir,
  type PendingRecovery,
} from "@/lib/project/session";
import {
  getRecentProjects,
  removeRecentProject,
  type RecentProject,
} from "@/lib/recents";
import { useWorkbenchStore } from "@/lib/stores/workbench-store";
import { useAuthStore, useCloudEnabled } from "@/lib/stores/auth-store";
import { usePreferencesStore } from "@/lib/stores/preferences-store";
import { listMyPacks, type Pack } from "@/lib/sync/api-client";
import { clonePackToLocal } from "@/lib/sync/clone";
import i18n from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/format";

const MARKET_TILES = [
  { Icon: Shirt, from: "#ff8a1f", to: "#f4456b", key: "clothing" },
  { Icon: Stamp, from: "#f472b6", to: "#9b6bff", key: "tattoos" },
  { Icon: Hand, from: "#34d399", to: "#4c8dff", key: "animations" },
] as const;

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function formatLastOpened(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(i18n.language, { dateStyle: "medium", timeStyle: "short" });
}

export function LauncherScreen() {
  const { t } = useTranslation("launcher");
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [recovery, setRecovery] = useState<PendingRecovery | null>(null);
  const [opening, setOpening] = useState(false);
  /** Which recent entry is currently loading (spinner on that row). */
  const [openingPath, setOpeningPath] = useState<string | null>(null);

  // Cloud projects: every approved team member sees all packs and can clone
  // one into a fresh local project with a single click. In solo mode the cloud
  // backend is disabled entirely, so nothing here renders or fires.
  const cloudEnabled = useCloudEnabled();
  const apiReady = useAuthStore(
    (s) =>
      cloudEnabled &&
      s.status === "loggedIn" &&
      s.user?.status === "approved",
  );
  /** null = still loading, [] = loaded but empty/unavailable. */
  const [cloudPacks, setCloudPacks] = useState<Pack[] | null>(null);
  /** packId of the pack currently being cloned (spinner on that row). */
  const [cloningId, setCloningId] = useState<string | null>(null);

  useEffect(() => {
    getRecentProjects()
      .then(setRecents)
      .catch(() => {
        /* store plugin unavailable (plain browser dev) */
      });
  }, []);

  useEffect(() => {
    if (!apiReady) {
      setCloudPacks(null);
      return;
    }
    setCloudPacks(null);
    listMyPacks()
      .then(setCloudPacks)
      // Sidecar/API unreachable — render the empty hint rather than an error.
      .catch(() => setCloudPacks([]));
  }, [apiReady]);

  const openFromDir = useCallback(async (dirPath: string) => {
    setOpening(true);
    setOpeningPath(dirPath);
    try {
      const { recovery } = await openProjectFromDir(dirPath);
      if (recovery) setRecovery(recovery);
    } catch (e) {
      toast.error(t("openProjectFailed"), {
        description: errorMessage(e),
      });
    } finally {
      setOpening(false);
      setOpeningPath(null);
    }
  }, [t]);

  const browseAndOpen = useCallback(async () => {
    try {
      const selected = await openDialog({
        directory: true,
        title: t("projectPickerTitle"),
        defaultPath:
          usePreferencesStore.getState().defaultProjectFolder ?? undefined,
      });
      if (typeof selected === "string") await openFromDir(selected);
    } catch (e) {
      toast.error(t("selectFolderFailed"), {
        description: errorMessage(e),
      });
    }
  }, [openFromDir, t]);

  const removeRecent = useCallback(async (dirPath: string) => {
    try {
      setRecents(await removeRecentProject(dirPath));
    } catch {
      /* best effort */
    }
  }, []);

  const cloneCloudPack = useCallback(async (pack: Pack) => {
    let parentDir: string | null;
    try {
      const selected = await openDialog({
        directory: true,
        title: t("cloud.clonePickerTitle"),
      });
      parentDir = typeof selected === "string" ? selected : null;
    } catch (e) {
      toast.error(t("selectFolderFailed"), {
        description: errorMessage(e),
      });
      return;
    }
    if (!parentDir) return;

    setCloningId(pack.packId);
    try {
      await clonePackToLocal(pack, parentDir);
      toast.success(t("cloud.clonedAndOpened", { name: pack.name }));
    } catch (e) {
      toast.error(t("cloud.cloneFailed"), {
        description: errorMessage(e),
      });
    } finally {
      setCloningId(null);
    }
  }, [t]);

  const titleWords = t("title").split(" ");
  const titleTail = titleWords.length > 1 ? (titleWords.pop() as string) : "";
  const titleHead = titleWords.join(" ");

  const actions = [
    {
      title: t("actions.newProject.title"),
      description: t("actions.newProject.description"),
      icon: Plus,
      cta: t("actions.newProject.cta"),
      onClick: () => setNewProjectOpen(true),
    },
    {
      title: t("actions.openProject.title"),
      description: t("actions.openProject.description"),
      icon: FolderOpen,
      cta: t("actions.openProject.cta"),
      onClick: () => void browseAndOpen(),
    },
    {
      title: t("actions.importPack.title"),
      description: t("actions.importPack.description"),
      icon: PackageOpen,
      cta: t("actions.importPack.cta"),
      onClick: () => useWorkbenchStore.getState().setImportWizardOpen(true),
    },
  ] as const;

  return (
    <div className="screen-fade-in flex h-full gap-8 overflow-hidden px-10 py-10">
      {/* Main column — full width with breathing room, scrolls independently. */}
      <div className="min-w-0 flex-1 overflow-y-auto pr-1">
        <section className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-card px-3.5 py-1.5 text-[13px] font-semibold text-ink-2 shadow-[var(--shadow-s)]">
            <span className="h-2 w-2 rounded-full bg-[image:var(--grad)]" />
            by Roleplay+
          </span>
          <h1 className="mt-5 text-[44px] font-semibold leading-[1.05] tracking-[-0.035em] text-foreground">
            {titleHead}
            {titleTail && <> <span className="grad">{titleTail}</span></>}
          </h1>
          <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-grey">{t("subtitle")}</p>
        </section>

        <div className="mt-9 grid grid-cols-1 gap-4 md:grid-cols-3">
          {actions.map(({ title, description, icon: Icon, cta, onClick }, i) => (
            <button
              key={title}
              type="button"
              disabled={opening}
              onClick={onClick}
              className={cn(
                "group animate-fade-in-up relative flex flex-col overflow-hidden rounded-[22px] p-6 text-left shadow-[var(--shadow-s)] transition-[transform,box-shadow] duration-300 [transition-timing-function:var(--ease)] hover:-translate-y-1 hover:shadow-[var(--shadow-m)] disabled:pointer-events-none disabled:opacity-50",
                i === 0 ? "bg-[#0d0d10] text-white" : "bg-card text-foreground",
                `animation-delay-${(i + 1) * 100}`,
              )}
            >
              {i === 0 && (
                <>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#ff8a1f]/35 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -bottom-24 -left-10 h-52 w-52 rounded-full bg-[#f4456b]/30 blur-3xl"
                  />
                </>
              )}
              <div
                className={cn(
                  "relative flex h-12 w-12 items-center justify-center rounded-[16px]",
                  i === 0 ? "bg-white/10 text-[#ffa233]" : "bg-fill text-brand",
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="relative mt-5 text-xl font-semibold tracking-tight">{title}</h3>
              <p className={cn("relative mt-1.5 text-sm leading-relaxed", i === 0 ? "text-white/60" : "text-grey")}>
                {description}
              </p>
              <span
                className={cn(
                  "relative mt-6 inline-flex items-center gap-1.5 text-sm font-semibold",
                  i === 0 ? "text-white" : "grad w-fit",
                )}
              >
                {cta}
                <ArrowRight
                  className={cn(
                    "h-4 w-4 transition-transform duration-300 group-hover:translate-x-1",
                    i === 0 ? "text-white" : "text-brand",
                  )}
                />
              </span>
            </button>
          ))}
        </div>

        <div className="group animate-fade-in-up animation-delay-400 relative mt-4 flex w-full items-center gap-8 overflow-hidden rounded-[22px] bg-card p-6 text-left shadow-[var(--shadow-s)]">
          <span aria-hidden className="pointer-events-none absolute -right-10 -top-24 h-56 w-72 rounded-full bg-[#ff8a1f]/20 blur-3xl" />
          <span aria-hidden className="pointer-events-none absolute -bottom-24 right-40 h-48 w-64 rounded-full bg-[#9b6bff]/15 blur-3xl" />
          <div className="relative min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-fill px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-grey">
              <Store className="h-3.5 w-3.5 text-brand" />
              {t("marketplace.eyebrow")}
            </span>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-foreground">
              {t("marketplace.title")}
            </h3>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-grey">{t("marketplace.text")}</p>
            <span className="mt-4 inline-flex items-center rounded-full bg-[image:var(--grad)] px-3.5 py-1 text-xs font-semibold text-white">
              {t("marketplace.soon")}
            </span>
          </div>
          <div className="relative hidden shrink-0 items-center gap-3 md:flex">
            {MARKET_TILES.map(({ Icon, from, to, key }, i) => (
              <div
                key={key}
                className="flex h-28 w-24 flex-col items-center justify-end gap-2 rounded-[20px] pb-3 text-white shadow-[var(--shadow-m)] transition-transform duration-500 [transition-timing-function:var(--ease)]"
                style={{
                  background: `linear-gradient(150deg, ${from}, ${to})`,
                  transform: `translateY(${i === 1 ? -8 : 6}px) rotate(${(i - 1) * 4}deg)`,
                }}
              >
                <Icon className="h-7 w-7" />
                <span className="text-[11px] font-semibold">{t(`marketplace.${key}`)}</span>
              </div>
            ))}
          </div>
        </div>

        {apiReady && (
          <>
            <h2 className="caps mt-14">
              {t("cloud.heading")}
            </h2>
            {cloudPacks === null ? (
              <div className="glass-border-subtle mt-3 flex flex-col gap-2 rounded-[14px] p-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-[14px] bg-fill"
                  />
                ))}
              </div>
            ) : cloudPacks.length === 0 ? (
              <div className="bg-card shadow-[var(--shadow-s)] mt-3 flex flex-col items-center justify-center rounded-[22px] px-6 py-12 text-center">
                <CloudOff className="h-8 w-8 text-faint" />
                <p className="mt-3 text-sm font-medium text-grey">
                  {t("cloud.emptyTitle")}
                </p>
                <p className="mt-1 max-w-sm text-xs text-faint">
                  {t("cloud.emptyHint")}
                </p>
              </div>
            ) : (
              <div className="bg-card shadow-[var(--shadow-s)] mt-3 flex flex-col rounded-[22px] p-2">
                {cloudPacks.map((pack) => {
                  const cloning = cloningId === pack.packId;
                  return (
                    <button
                      key={pack.packId}
                      type="button"
                      disabled={cloningId !== null}
                      onClick={() => void cloneCloudPack(pack)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:bg-fill-2 disabled:opacity-50",
                        cloning && "bg-brand/10 !opacity-100",
                      )}
                    >
                      {cloning ? (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-fill"><Loader2 className="h-4 w-4 animate-spin text-brand" /></span>
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-fill"><Cloud className="h-4 w-4 text-brand" /></span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {pack.name}
                        </p>
                        <p className="truncate text-xs text-faint">
                          {cloning
                            ? t("cloud.cloning")
                            : t("cloud.revision", { revision: pack.headRevision })}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-faint">
                        {formatRelativeTime(pack.updatedAt)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        <h2 className="caps mt-14">
          {t("recents.heading")}
        </h2>
        {recents.length === 0 ? (
          <div className="bg-card shadow-[var(--shadow-s)] mt-3 flex flex-col items-center justify-center rounded-[22px] px-6 py-12 text-center">
            <Clock className="h-8 w-8 text-faint" />
            <p className="mt-3 text-sm font-medium text-grey">
              {t("recents.emptyTitle")}
            </p>
            <p className="mt-1 max-w-sm text-xs text-faint">
              {t("recents.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="bg-card shadow-[var(--shadow-s)] mt-3 flex flex-col rounded-[22px] p-2">
            {recents.map((recent) => (
              <ContextMenu key={recent.dirPath}>
                <ContextMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={opening}
                    onClick={() => void openFromDir(recent.dirPath)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:bg-fill-2 disabled:opacity-50",
                      openingPath === recent.dirPath && "bg-brand/10 !opacity-100",
                    )}
                  >
                    {openingPath === recent.dirPath ? (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-fill"><Loader2 className="h-4 w-4 animate-spin text-brand" /></span>
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-fill"><Folder className="h-4 w-4 text-brand" /></span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {recent.name}
                      </p>
                      <p className="truncate text-xs text-faint">
                        {openingPath === recent.dirPath
                          ? t("recents.loading")
                          : recent.dirPath}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-faint">
                      {formatLastOpened(recent.lastOpenedAt)}
                    </span>
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    onClick={() => void openFromDir(recent.dirPath)}
                  >
                    {t("recents.open")}
                  </ContextMenuItem>
                  <ContextMenuItem
                    variant="destructive"
                    onClick={() => void removeRecent(recent.dirPath)}
                  >
                    {t("recents.removeFromList")}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        )}

        <GrzybeekCredits className="mt-14 justify-start" />
      </div>

      {/* Right sidebar: who is online and in which project. Cloud-only. */}
      {cloudEnabled && (
        <aside className="hidden w-80 shrink-0 lg:block">
          <OnlinePanel />
        </aside>
      )}

      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
      <RecoveryDialog recovery={recovery} onClose={() => setRecovery(null)} />
    </div>
  );
}
