import { Navigation } from "./landing_page_sections/Navigation";
import { HeroSection } from "./landing_page_sections/HeroSection";
import { SocialProof } from "./landing_page_sections/SocialProof";
import { FeaturesSection } from "./landing_page_sections/FeaturesSection";
import { WhyChooseUsSection } from "./landing_page_sections/WhyChooseUsSection";
import { ReviewsSection } from "./landing_page_sections/ReviewsSection";
import { FAQSection } from "./landing_page_sections/FAQSection";
import { CTASection } from "./landing_page_sections/CTASection";
import { Footer } from "./landing_page_sections/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream-100">
      <Navigation />
      <HeroSection />
      <SocialProof />
      <FeaturesSection />
      <WhyChooseUsSection />
      <ReviewsSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  );
}
