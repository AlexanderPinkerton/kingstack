"use client";

import { useEffect, useRef, useState } from "react";

interface Foundation {
  domain: string;
  covers: string;
  detail: string;
  tag: string;
}

/* Each module names one thing that exists in the generated repo. These lines
   stay at artifact altitude — what is in there — because the stack section
   below makes the argument for each choice, and the quality-of-life section
   covers the repo's own upkeep. Saying it once, in the right place.        */
const foundations: Foundation[] = [
  {
    domain: "Auth",
    covers: "Sign-in, sessions, and roles",
    detail: "A sign-in flow, protected routes, and admin guards in both apps.",
    tag: "Supabase Auth",
  },
  {
    domain: "Data",
    covers: "Schema, types, and client",
    detail: "A shared schema package generates the Prisma client and types.",
    tag: "Prisma",
  },
  {
    domain: "Runtime",
    covers: "Frontend and API",
    detail: "Next.js and NestJS share one repository and development workflow.",
    tag: "Next.js + NestJS",
  },
  {
    domain: "State",
    covers: "Server cache and optimistic writes",
    detail: "Memory and HTTP repositories use the same store contract.",
    tag: "TanStack Query + MobX",
  },
  {
    domain: "Realtime",
    covers: "Multi-client updates",
    detail: "Authenticated server events reconcile with client state.",
    tag: "Socket.IO",
  },
  {
    domain: "Migrations",
    covers: "Schema changes in production",
    detail: "Versioned migration files and a production deploy command.",
    tag: "yarn prisma:deploy",
  },
  {
    domain: "Config",
    covers: "Environment variables",
    detail: "Typed local, development, and production configuration.",
    tag: "yarn env:local",
  },
  {
    domain: "Logs",
    covers: "Request tracing",
    detail: "Contextual logs in the browser, Next.js, and NestJS.",
    tag: "Pino",
  },
  {
    domain: "UI",
    covers: "Components and theming",
    detail: "A component library and editable design tokens in the repository.",
    tag: "Tailwind + Radix",
  },
  {
    domain: "Storage",
    covers: "File uploads",
    detail: "File storage configured beside PostgreSQL and Auth.",
    tag: "Supabase Storage",
  },
  {
    domain: "Deploy",
    covers: "Shipping it",
    detail: "Scripts for the frontend, API, database, and secrets.",
    tag: "yarn deploy:nest",
  },
];

const LIME = "#d8ff70";
const SNAP = 70;
const CYCLE = 2600;

export function FoundationConsole() {
  const frame = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [live, setLive] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  // Once someone points at a module the panel stops narrating over them.
  const [engaged, setEngaged] = useState(false);
  const [cycle, setCycle] = useState(0);

  // Hold the power-up until the console is on screen — it is the whole point
  // of the section and it should not have already happened.
  useEffect(() => {
    const node = frame.current;
    if (!node || started) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setStarted(true);
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setLive(foundations.length);
        }
        observer.disconnect();
      },
      { threshold: 0.25 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [started]);

  // One timer drives both the module stagger and the tally, so they can never
  // disagree.
  useEffect(() => {
    if (!started || live >= foundations.length) return;
    const timer = setTimeout(() => setLive(live + 1), SNAP);
    return () => clearTimeout(timer);
  }, [started, live]);

  const settled = live >= foundations.length;
  const narrating = settled && !engaged;

  // With everything up, the panel walks the readout through the bay itself, so
  // it demonstrates rather than waiting to be discovered.
  useEffect(() => {
    if (!narrating) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(
      () => setCycle((index) => (index + 1) % foundations.length),
      CYCLE,
    );
    return () => clearInterval(timer);
  }, [narrating]);

  const focused = active ?? (narrating ? cycle : null);
  const current = focused === null ? null : foundations[focused];

  const engage = (index: number) => {
    setEngaged(true);
    setActive(index);
  };

  return (
    <div className="mt-14" ref={frame}>
      <p className="sr-only">
        {foundations.length} configured parts of the generated project.
      </p>

      <div
        className="[perspective:1600px]"
        onMouseLeave={() => setActive(null)}
      >
        <div
          className="overflow-hidden rounded-[2rem] border border-white/10 p-6 sm:p-9"
          style={{
            transform: "rotateX(11deg)",
            transformOrigin: "50% 100%",
            backgroundImage:
              "linear-gradient(168deg, rgba(255,255,255,0.055), rgba(9,10,12,0.98) 58%)",
            boxShadow:
              "0 50px 90px -30px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          {/* Readout */}
          <div
            aria-hidden="true"
            className="rounded-[1.25rem] border border-white/10 px-6 py-5 sm:px-8 sm:py-6"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.022) 0 1px, transparent 1px 3px), linear-gradient(160deg, rgba(216,255,112,0.05), rgba(4,5,6,0.96) 62%)",
              boxShadow: "inset 0 2px 26px rgba(0,0,0,0.75)",
            }}
          >
            <div className="flex items-start justify-between gap-6">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/30">
                {current ? current.covers : "The foundation"}
              </p>
              <p className="shrink-0 font-mono text-xs tracking-[0.14em] text-[#d8ff70]">
                {live.toString().padStart(2, "0")}/{foundations.length} HANDLED
              </p>
            </div>

            {/* Sized for the longest line so the cycling readout never jumps */}
            <p className="mt-4 min-h-[7rem] text-base font-medium leading-7 tracking-[-0.025em] text-white/85 sm:min-h-[4rem] sm:text-2xl sm:leading-8">
              {current
                ? current.detail
                : "Twelve systems, ready on the first run."}
              <span
                className="ml-1 inline-block h-5 w-2 translate-y-0.5 animate-pulse bg-[#d8ff70]/70"
                aria-hidden="true"
              />
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="font-mono text-sm text-white/35">
                {current
                  ? `${current.domain} — running`
                  : "Bringing the foundation up…"}
              </p>
              {current ? (
                <span
                  className="rounded-full border px-3 py-1 font-mono text-xs"
                  style={{
                    color: LIME,
                    borderColor: `${LIME}3d`,
                    backgroundColor: `${LIME}0f`,
                  }}
                >
                  {current.tag}
                </span>
              ) : null}
            </div>
          </div>

          {/* Module bay — everything in it is seated and running. There is
              nothing here to operate, so nothing here looks operable. */}
          <div
            className="mt-6 rounded-[1.25rem] p-3 sm:p-4"
            style={{ boxShadow: "inset 0 2px 22px rgba(0,0,0,0.6)" }}
          >
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {foundations.map((foundation, index) => {
                const on = index < live;
                const isActive = focused === index;

                return (
                  <button
                    key={foundation.domain}
                    type="button"
                    aria-label={`${foundation.domain}: ${foundation.covers}. Ready. ${foundation.detail}`}
                    onMouseEnter={() => engage(index)}
                    onFocus={() => engage(index)}
                    onBlur={() => setActive(null)}
                    className="group relative flex cursor-default flex-col justify-between gap-5 overflow-hidden rounded-xl border px-4 pb-3.5 pt-3 text-left transition-all duration-300 ease-out focus:outline-none motion-reduce:transition-none"
                    style={{
                      borderColor: on
                        ? isActive
                          ? `${LIME}80`
                          : `${LIME}26`
                        : "rgba(255,255,255,0.06)",
                      backgroundImage: on
                        ? `linear-gradient(165deg, ${isActive ? `${LIME}1f` : "rgba(255,255,255,0.06)"}, rgba(12,13,16,0.96) 68%)`
                        : "linear-gradient(165deg, rgba(255,255,255,0.014), rgba(10,11,13,0.96) 68%)",
                      boxShadow: on
                        ? `0 10px 22px -14px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.07)${
                            isActive ? `, 0 0 30px ${LIME}2e` : ""
                          }`
                        : "none",
                      transform: on ? "translateY(0)" : "translateY(3px)",
                      opacity: on ? 1 : 0.55,
                    }}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span
                        className="size-1.5 shrink-0 rounded-full transition-all duration-300 motion-reduce:transition-none"
                        style={{
                          backgroundColor: on ? LIME : "rgba(255,255,255,0.1)",
                          boxShadow: on
                            ? `0 0 10px ${LIME}${isActive ? "" : "b3"}`
                            : "none",
                        }}
                      />
                      <span
                        className="font-mono text-[0.58rem] uppercase tracking-[0.2em] transition-opacity duration-500 motion-reduce:transition-none"
                        style={{ color: LIME, opacity: on ? 0.72 : 0 }}
                      >
                        Ready
                      </span>
                    </span>

                    <span
                      className="font-mono text-[0.72rem] uppercase tracking-[0.18em] transition-colors duration-300 motion-reduce:transition-none"
                      style={{
                        color: isActive
                          ? "#f5f2e8"
                          : on
                            ? "rgba(245,242,232,0.6)"
                            : "rgba(245,242,232,0.2)",
                      }}
                    >
                      {foundation.domain}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
