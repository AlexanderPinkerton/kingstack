import { HeroSection } from "@/components/core/hero-section";
import { FeaturesSection } from "@/components/core/features-section";
import { CtaSection } from "@/components/core/cta-section";
import { Footer } from "@/components/core/footer";
import { AppNavbar } from "@/components/navbar/presets/app";
import { RealtimeCheckboxes } from "@/components/examples/RealtimeCheckboxes";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-slate-900 text-white">
      <AppNavbar />
      <HeroSection />
      <FeaturesSection />

      {/* Realtime Checkboxes Example */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <RealtimeCheckboxes />
        </div>
      </section>

      <CtaSection />
      <Footer />
    </main>
  );
}
