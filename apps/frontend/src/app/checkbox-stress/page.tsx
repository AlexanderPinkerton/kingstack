"use client";

import { CheckboxStressTest } from "@/components/examples/CheckboxStressTest";

export default function CheckboxStressPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <CheckboxStressTest />
      </div>
    </main>
  );
}
