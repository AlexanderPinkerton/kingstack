"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";

export function SocialProof() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const logos = [
    { name: "VM", text: "VM" },
    { name: "Logolpsum", text: "Logolpsum" },
    { name: "Company", text: "∞" },
    { name: "Brand", text: "●" },
    { name: "Logo", text: "▲" },
    { name: "VM", text: "VM" },
    { name: "Logolpsum", text: "Logolpsum" },
    { name: "Company", text: "∞" },
    { name: "Brand", text: "●" },
    { name: "Logo", text: "▲" },
    // Triple for seamless loop
    { name: "VM", text: "VM" },
    { name: "Logolpsum", text: "Logolpsum" },
    { name: "Company", text: "∞" },
    { name: "Brand", text: "●" },
    { name: "Logo", text: "▲" },
  ];

  return (
    <section ref={ref} className="w-full px-6 py-16 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          {/* Left side - Text */}
          <motion.div
            className="lg:col-span-1"
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.8, ease: "easeOut" as const }}
          >
            <p className="text-sm text-gray-600 uppercase tracking-wide font-medium leading-relaxed">
              WE ARE PARTNERED WITH MORE THAN 50+
              <br />
              COMPANIES AROUND THE GLOBE
            </p>
          </motion.div>

          {/* Center - Smooth scrolling logos */}
          <motion.div
            className="lg:col-span-1 opacity-60"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 0.6, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" as const }}
          >
            <div className="relative w-full overflow-hidden h-16">
              <motion.div
                className="flex animate-scroll-smooth hover:pause-animation"
                initial={{ x: -100 }}
                animate={isInView ? { x: 0 } : { x: -100 }}
                transition={{ duration: 1, delay: 0.4 }}
              >
                {logos.map((logo, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center justify-center min-w-[120px] h-16 flex-shrink-0"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={
                      isInView
                        ? { opacity: 1, scale: 1 }
                        : { opacity: 0, scale: 0.8 }
                    }
                    transition={{
                      duration: 0.5,
                      delay: 0.6 + index * 0.1,
                      ease: "easeOut" as const,
                    }}
                    whileHover={{ scale: 1.1 }}
                  >
                    <div className="text-gray-400 font-medium text-lg">
                      {logo.text}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </motion.div>

          {/* Right side - Instruction */}
          <motion.div
            className="lg:col-span-1 flex justify-end"
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" as const }}
          >
            <motion.div
              className="bg-cream-100 rounded-lg shadow-sm border p-6 max-w-sm"
              whileHover={{ scale: 1.02, y: -5 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="font-semibold text-gray-900 mb-2">
                Add instant credibility with some logos
              </h3>
              <p className="text-sm text-gray-600">
                Showcase well-known partners or clients you and your customers
                similarly trust in seconds.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
