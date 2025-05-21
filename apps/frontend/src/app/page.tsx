import { HeroSection } from "@/components/core/hero-section";
import { FeaturesSection } from "@/components/core/features-section";
import { CtaSection } from "@/components/core/cta-section";
import { Footer } from "@/components/core/footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-slate-900 text-white">
      <HeroSection />
      <FeaturesSection />
      <CtaSection />
      <Footer />
    </main>
  );
}