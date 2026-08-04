import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface AppPageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function AppPageHeader({
  eyebrow,
  title,
  description,
}: AppPageHeaderProps) {
  return (
    <header className="mb-10">
      <Link
        href="/app"
        className="mb-8 inline-flex items-center gap-2 text-sm text-white/45 transition-colors hover:text-white"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to the application
      </Link>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#d8ff70]">
        {eyebrow}
      </p>
      <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">
        {title}
      </h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">
        {description}
      </p>
    </header>
  );
}
