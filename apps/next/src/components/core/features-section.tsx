"use client";

import { useRef, useEffect } from "react";
import { Zap, Shield, Smartphone, Code, Layers, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: <Zap className="h-10 w-10" />,
    title: "Lightning Fast",
    description:
      "Optimized for speed and performance, ensuring your users have a seamless experience.",
  },
  {
    icon: <Shield className="h-10 w-10" />,
    title: "Secure by Default",
    description:
      "Built with security best practices to keep your data and users safe.",
  },
  {
    icon: <Smartphone className="h-10 w-10" />,
    title: "Fully Responsive",
    description:
      "Looks great on any device, from mobile phones to desktop computers.",
  },
  {
    icon: <Code className="h-10 w-10" />,
    title: "Clean Code",
    description:
      "Modular and well-organized codebase that's easy to maintain and extend.",
  },
  {
    icon: <Layers className="h-10 w-10" />,
    title: "Modern Stack",
    description:
      "Built with the latest technologies and best practices in web development.",
  },
  {
    icon: <RefreshCw className="h-10 w-10" />,
    title: "Continuous Updates",
    description:
      "Regular updates and improvements to keep your project on the cutting edge.",
  },
];

export function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const featureRefs = useRef<(HTMLDivElement | null)[]>([]);

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

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    featureRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }

      featureRefs.current.forEach((ref) => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, []);

  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
      <div
        ref={sectionRef}
        className="max-w-7xl mx-auto text-center opacity-0 translate-y-8 transition-all duration-700"
      >
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-600">
            Powerful Features
          </span>
        </h2>
        <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-16">
          Everything you need to build modern web applications, all in one
          place.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              ref={(el) => {
                featureRefs.current[index] = el;
              }}
              className={cn(
                "bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-8 opacity-0 translate-y-8 transition-all",
                "hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300",
              )}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="text-cyan-400 mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
