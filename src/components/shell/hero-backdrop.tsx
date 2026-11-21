/**
 * Shared ambient backdrop in the Roleplay+ look: three soft, slowly drifting
 * colour blobs (amber, coral, violet) on paper. Used by the login gate and the
 * launcher/settings screens (NOT the workbench, which stays plain so the 3D
 * preview stays distraction free). Renders absolute z-0 layers - the host must
 * be `relative` and place its content at z-10+.
 *
 * `strong` calms the glow for content-heavy screens (launcher/settings).
 */

import { cn } from "@/lib/utils";

export function HeroBackdrop({ strong = false }: { strong?: boolean }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-0 overflow-hidden", strong ? "opacity-60" : "opacity-100")}
      aria-hidden="true"
    >
      <div className="rp-blob rp-blob-1" />
      <div className="rp-blob rp-blob-2" />
      <div className="rp-blob rp-blob-3" />
    </div>
  );
}
