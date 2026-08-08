"use client";

import Link from "next/link";
import { ArrowRight, LogIn, Radio } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useRootStore } from "@/hooks/useRootStore";

interface GuestDemoGateProps {
  children: ReactNode;
  requiresPermanentAccount?: boolean;
}

/** One account entry surface shared by every JWT-backed live demo. */
export const GuestDemoGate = observer(function GuestDemoGate({
  children,
  requiresPermanentAccount = false,
}: GuestDemoGateProps) {
  const rootStore = useRootStore();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!rootStore.sessionReady) {
    return (
      <section className="grid min-h-[26rem] place-items-center rounded-[2rem] border border-white/10 bg-[#111216]/85 text-white/45">
        Preparing the live demo…
      </section>
    );
  }

  if (rootStore.session && (!requiresPermanentAccount || !rootStore.isGuest)) {
    return children;
  }

  async function startDemo(): Promise<void> {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await rootStore.startGuestSession();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The guest session could not be created.",
      );
      setPending(false);
    }
  }

  return (
    <section className="relative grid min-h-[32rem] place-items-center overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c0d10] p-6 shadow-2xl shadow-black/20 sm:p-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(circle at 82% 10%, rgba(118, 85, 255, 0.22), transparent 34%), radial-gradient(circle at 12% 100%, rgba(216, 255, 112, 0.09), transparent 30%)",
        }}
      />
      <div className="relative max-w-2xl text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full border border-white/15 bg-white/[0.05]">
          <Radio className="size-5 text-[#d8ff70]" aria-hidden="true" />
        </span>
        <p className="mt-6 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#d8ff70]">
          {requiresPermanentAccount
            ? "Permanent account required"
            : "Account required"}
        </p>
        <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">
          {requiresPermanentAccount
            ? "This demo requires a permanent account."
            : "This demo require an account."}
        </h2>
        <p className="mx-auto mt-5 max-w-xl leading-7 text-white/50">
          {requiresPermanentAccount
            ? "The optimistic UI demo writes to the real post database. Log in or register to continue."
            : "Join with a temporary guest account, or log in or register for a permanent one."}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {!requiresPermanentAccount && (
            <Button
              type="button"
              size="lg"
              disabled={pending}
              onClick={() => void startDemo()}
              className="bg-[#d8ff70] text-[#11130d] hover:bg-[#e3ff98]"
            >
              {pending ? "Joining as guest…" : "Join as guest"}
              {!pending && <ArrowRight aria-hidden="true" />}
            </Button>
          )}
          <Button
            asChild
            type="button"
            size="lg"
            variant="outline"
            className="border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/login">
              <LogIn aria-hidden="true" />
              Log in or register
            </Link>
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-5 text-sm text-[#ffb6ac]">
            {error}
          </p>
        )}
        <p className="mt-6 font-mono text-[0.6rem] uppercase leading-5 tracking-[0.12em] text-white/30">
          {requiresPermanentAccount
            ? "Guest sessions cannot access persisted post data."
            : "Guest accounts are temporary and limited to the live demos."}
        </p>
      </div>
    </section>
  );
});
