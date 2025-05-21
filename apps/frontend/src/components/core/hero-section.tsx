"use client";

import { useEffect, useRef } from "react";
import { Navbar } from "./navbar";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null);

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
                entry.target.classList.add("duration-1000");
              }
            }, 100);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -100px 0px" },
    );

    if (heroRef.current) {
      observer.observe(heroRef.current);
    }

    return () => {
      if (heroRef.current) {
        observer.unobserve(heroRef.current);
      }
    };
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-16">
        <div
          ref={heroRef}
          className="max-w-5xl mx-auto text-center opacity-0 translate-y-8 transition-all duration-1000"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6">
            <span className="block">Build the Future with</span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">
              Kingstack
            </span>
          </h1>

          <p className="mt-6 text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
            A modern and sleek template for your next project. Fast, responsive,
            and built with the latest technologies.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white border-0 text-lg group"
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-slate-700 bg-slate-900/50 text-gray-300 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-slate-800/50 backdrop-blur-sm text-lg transition-all duration-300"
            >
              Learn More
            </Button>
          </div>

          <div className="mt-20 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent z-10 h-20 bottom-0"></div>
            <div className="relative z-0 rounded-xl overflow-hidden border border-slate-800 shadow-2xl shadow-purple-500/10">
              <div className="bg-slate-900 aspect-video rounded-xl overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                  <div className="text-2xl text-gray-500 font-mono">
                    Your app preview here
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
