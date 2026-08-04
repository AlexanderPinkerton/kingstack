"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

interface InstallCommandProps {
  command: string;
  tone?: "dark" | "light";
  className?: string;
}

export function InstallCommand({
  command,
  tone = "dark",
  className = "",
}: InstallCommandProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(command).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }, [command]);

  const isLight = tone === "light";

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 font-mono text-sm ${
        isLight
          ? "border-black/15 bg-black/[0.04] text-[#171812]"
          : "border-white/15 bg-white/[0.04] text-[#f5f2e8]"
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`select-none ${isLight ? "text-[#6555d9]" : "text-[#d8ff70]"}`}
      >
        $
      </span>
      <code className="flex-1 overflow-x-auto whitespace-nowrap">
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Command copied" : `Copy "${command}"`}
        className={`grid size-8 shrink-0 place-items-center rounded-lg border transition ${
          isLight
            ? "border-black/10 hover:border-black/25 hover:bg-black/[0.05]"
            : "border-white/10 hover:border-white/30 hover:bg-white/[0.08]"
        }`}
      >
        {copied ? (
          <Check
            className={`size-4 ${isLight ? "text-[#6555d9]" : "text-[#d8ff70]"}`}
            aria-hidden="true"
          />
        ) : (
          <Copy className="size-4 opacity-60" aria-hidden="true" />
        )}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </div>
  );
}
