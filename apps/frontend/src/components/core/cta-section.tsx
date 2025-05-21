"use client";

import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Add the animation classes with a small delay to ensure they take effect
            setTimeout(() => {
              if (entry.target.classList.contains("opacity-0")) {
                entry.target.classList.remove("opacity-0");
                entry.target.classList.add("opacity-100");
                entry.target.classList.add("translate-y-0");
                entry.target.classList.add("transition-all");
                entry.target.classList.add("duration-700");
              }
            }, 100);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -100px 0px" },
    );

    if (ctaRef.current) {
      observer.observe(ctaRef.current);
    }

    return () => {
      if (ctaRef.current) {
        observer.unobserve(ctaRef.current);
      }
    };
  }, []);

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div
        ref={ctaRef}
        className="max-w-5xl mx-auto rounded-2xl overflow-hidden opacity-0 translate-y-8 transition-all duration-700"
      >
        <div className="relative">
          {/* Background with gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-600/20 mix-blend-multiply"></div>

          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-8 md:p-12 lg:p-16">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden rounded-2xl">
              <div className="absolute -top-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full opacity-20 blur-3xl"></div>
              <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-purple-600 rounded-full opacity-20 blur-3xl"></div>
            </div>

            <div className="relative z-10 text-center">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
                Ready to Build Something Amazing?
              </h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-10">
                Join thousands of developers who are already using Kingstack to
                build the next generation of web applications.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white border-0 text-lg group"
                >
                  Get Started Now
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-slate-700 bg-slate-900/50 text-gray-300 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-slate-800/50 backdrop-blur-sm text-lg transition-all duration-300"
                >
                  View Documentation
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
