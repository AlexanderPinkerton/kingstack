import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Boxes,
  Check,
  ChevronRight,
  Gauge,
  LayoutDashboard,
  Search,
  Settings2,
  Sparkles,
  Users2,
} from "lucide-react";
import type { ThemeLabStore } from "./theme-lab-store";

const activity = [
  { label: "API requests", value: "24.8k", change: "+18%" },
  { label: "Active users", value: "1,429", change: "+7.2%" },
  { label: "Success rate", value: "99.98%", change: "+0.4%" },
] as const;

const chartBars = [42, 58, 47, 70, 63, 82, 76, 94, 84, 100, 91, 112] as const;

function PreviewMetric({
  icon: Icon,
  label,
  value,
  change,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  change: string;
}) {
  return (
    <article className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-[var(--theme-space)] transition-all duration-300">
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-8 place-items-center rounded-[var(--theme-radius-sm)] bg-[var(--accent)] text-[var(--accent-1-m)]">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <span className="rounded-full bg-[var(--secondary)] px-2 py-1 font-mono text-[0.58rem] text-[var(--accent-2-m)]">
          {change}
        </span>
      </div>
      <p className="mt-5 text-[0.65rem] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-[-0.045em]">{value}</p>
    </article>
  );
}

function PreviewSidebar() {
  const links = [
    { icon: LayoutDashboard, label: "Overview", active: true },
    { icon: Activity, label: "Activity", active: false },
    { icon: Users2, label: "Customers", active: false },
    { icon: Boxes, label: "Deployments", active: false },
  ] as const;

  return (
    <aside className="hidden w-44 shrink-0 border-r border-[var(--border)] bg-[var(--card)] p-3 lg:flex lg:flex-col">
      <div className="flex items-center gap-2 px-2 py-2">
        <span className="grid size-7 place-items-center rounded-[var(--theme-radius-sm)] bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)] text-[var(--primary-foreground)] shadow-lg">
          <Sparkles className="size-3.5" aria-hidden="true" />
        </span>
        <span className="text-xs font-semibold tracking-[-0.02em]">
          Orbit OS
        </span>
      </div>

      <nav className="mt-6 space-y-1" aria-label="Preview navigation">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <div
              key={link.label}
              className={`flex items-center gap-2 rounded-[var(--theme-radius-sm)] px-2.5 py-2 text-[0.68rem] transition-colors ${
                link.active
                  ? "bg-[var(--accent)] text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)]"
              }`}
            >
              <Icon
                className={`size-3.5 ${
                  link.active ? "text-[var(--accent-1-m)]" : ""
                }`}
                aria-hidden="true"
              />
              {link.label}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] p-3">
        <p className="text-[0.58rem] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          Current plan
        </p>
        <p className="mt-1.5 text-xs font-medium">Pro workspace</p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--border)]">
          <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-[var(--gradient-from)] to-[var(--gradient-to)]" />
        </div>
      </div>
    </aside>
  );
}

export const ThemePreview = observer(function ThemePreview({
  store,
}: {
  store: ThemeLabStore;
}) {
  const previewStyle = store.cssVariables as CSSProperties;
  const glowStyle = {
    boxShadow:
      "0 30px 90px color-mix(in oklch, var(--accent-1-m) var(--theme-glow), transparent)",
  };

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35">
            Live application preview
          </p>
          <p className="mt-1 text-sm text-white/60">
            One variable boundary. Every component below inherits it.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[0.62rem] text-white/45">
          <span className="size-1.5 rounded-full bg-[#d8ff70] shadow-[0_0_8px_#d8ff70]" />
          No refresh · scoped live
        </div>
      </div>

      <section
        style={{ ...previewStyle, ...glowStyle }}
        className="relative isolate flex min-h-[42rem] overflow-hidden rounded-[var(--theme-radius-shell)] border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] transition-[background-color,color,border-radius,box-shadow] duration-300"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-35"
          style={{
            background:
              "radial-gradient(circle at 82% 4%, color-mix(in oklch, var(--accent-2-m) 35%, transparent), transparent 30%), radial-gradient(circle at 12% 94%, color-mix(in oklch, var(--accent-1-m) 22%, transparent), transparent 28%)",
          }}
        />

        <PreviewSidebar />

        <div className="min-w-0 flex-1">
          <header className="flex h-16 items-center gap-3 border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--card)_86%,transparent)] px-4 backdrop-blur-xl sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="text-[0.58rem] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Workspace / Overview
              </p>
              <p className="mt-0.5 truncate text-xs font-medium">
                Production command center
              </p>
            </div>
            <label className="relative hidden sm:block">
              <Search
                className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--muted-foreground)]"
                aria-hidden="true"
              />
              <input
                readOnly
                value=""
                placeholder="Search"
                aria-label="Preview search"
                className="h-9 w-36 rounded-[var(--theme-radius-sm)] border border-[var(--input)] bg-[var(--muted)] pl-9 pr-3 text-xs outline-none placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)]"
              />
            </label>
            <button
              type="button"
              aria-label="Notifications"
              className="grid size-9 place-items-center rounded-[var(--theme-radius-sm)] border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)]"
            >
              <Bell className="size-3.5" aria-hidden="true" />
            </button>
            <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)] text-[0.62rem] font-bold text-[var(--primary-foreground)]">
              AP
            </span>
          </header>

          <main className="p-[var(--theme-space)] sm:p-[var(--theme-space-lg)]">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[0.62rem] font-medium uppercase tracking-[0.14em] text-[var(--accent-1-m)]">
                  <Gauge className="size-3.5" aria-hidden="true" />
                  Live systems
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] sm:text-3xl">
                  Everything is moving.
                </h2>
                <p className="mt-2 max-w-md text-xs leading-5 text-[var(--muted-foreground)]">
                  A realistic interface consuming the same small semantic token
                  set—from navigation to charts and controls.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-[var(--theme-radius-sm)] bg-gradient-to-r from-[var(--gradient-from)] via-[var(--accent-mix)] to-[var(--gradient-to)] px-3.5 text-xs font-semibold text-[var(--primary-foreground)] shadow-lg"
              >
                New deployment
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <PreviewMetric icon={Activity} {...activity[0]} />
              <PreviewMetric icon={Users2} {...activity[1]} />
              <PreviewMetric icon={Check} {...activity[2]} />
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-[1.35fr_0.65fr]">
              <article className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-[var(--theme-space)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">Request volume</p>
                    <p className="mt-1 text-[0.65rem] text-[var(--muted-foreground)]">
                      Last 12 hours · all environments
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1 text-[0.6rem] text-[var(--muted-foreground)]">
                    Live
                  </span>
                </div>

                <div className="mt-7 flex h-32 items-end gap-1.5 border-b border-[var(--border)] pb-2">
                  {chartBars.map((height, index) => (
                    <div
                      key={`${height}-${index}`}
                      className="min-w-0 flex-1 rounded-t-[var(--theme-radius-xs)] transition-all duration-300"
                      style={{
                        height: `${height}px`,
                        background:
                          index > 8
                            ? "linear-gradient(to top, var(--accent-2-m), var(--accent-1-m))"
                            : "color-mix(in oklch, var(--accent-1-m) 42%, var(--card))",
                      }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between font-mono text-[0.55rem] text-[var(--muted-foreground)]">
                  <span>08:00</span>
                  <span>14:00</span>
                  <span>Now</span>
                </div>
              </article>

              <article className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-[var(--theme-space)]">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Deployments</p>
                  <Settings2
                    className="size-3.5 text-[var(--muted-foreground)]"
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    ["Web", "Healthy", "accentOne"],
                    ["API", "Deploying", "accentTwo"],
                    ["Workers", "Healthy", "accentOne"],
                  ].map(([name, status, tone]) => (
                    <div
                      key={name}
                      className="flex items-center gap-2 rounded-[var(--theme-radius-sm)] border border-[var(--border)] bg-[var(--muted)] p-2.5"
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{
                          background:
                            tone === "accentOne"
                              ? "var(--accent-1-m)"
                              : "var(--accent-2-m)",
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.68rem] font-medium">{name}</p>
                        <p className="mt-0.5 text-[0.58rem] text-[var(--muted-foreground)]">
                          {status}
                        </p>
                      </div>
                      <ChevronRight
                        className="size-3.5 text-[var(--muted-foreground)]"
                        aria-hidden="true"
                      />
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </main>
        </div>
      </section>
    </div>
  );
});
