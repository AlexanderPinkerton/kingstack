"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function HeroSection() {
  return (
    <section className="w-full p-8 font-gambetta">
      <div className="bg-cream-200 rounded-[42px] px-6 py-20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            className="space-y-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" as const }}
          >
            <div className="space-y-4">
              <motion.div
                className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full inline-block"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.5,
                  delay: 0.3,
                  type: "spring",
                  stiffness: 200,
                }}
              >
                Featured Best App of 2024 →
              </motion.div>
              <motion.div
                className="text-[96px] text-left font-mono font-bold text-gray-900 leading-[80px]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.1,
                  ease: "easeOut" as const,
                }}
              >
                Email Agents
                <span className=" p-2 font-serif rounded-2xl text-orange-400">
                  made easy
                </span>
              </motion.div>
              <motion.p
                className="text-lg text-left font-serif text-gray-600 leading-relaxed"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  delay: 0.4,
                  ease: "easeOut" as const,
                }}
              >
                Our ChatGPT-like, natural user experience lets users features —
                give them a reason to trust or download right away.
              </motion.p>
            </div>

            <motion.div
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.6,
                ease: "easeOut" as const,
              }}
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  size="lg"
                  className="!bg-black !text-white hover:!bg-gray-800"
                >
                  Download now
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button variant="outline" size="lg" className="border-gray-300">
                  Download app
                </Button>
              </motion.div>
            </motion.div>

            <motion.p
              className="text-sm text-gray-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              200K+ Downloads
            </motion.p>
          </motion.div>

          <motion.div
            className="relative flex justify-center items-center h-full min-h-[500px] bg-transparent"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" as const }}
          >
            {/* Circular Video with Circular Text */}
            <div className="relative">
              {/* Circular Video */}
              <div
                className="w-[300px] h-[300px] overflow-hidden shadow-2xl relative"
                style={{
                  borderRadius: "50%",
                  clipPath: "circle(50%)",
                }}
              >
                <video
                  className="w-full h-full object-cover opacity-70"
                  style={{
                    imageRendering: "crisp-edges",
                    transform: "scale(0.01) scale(100)",
                    filter: "blur(0px) contrast(1)",
                  }}
                  autoPlay
                  muted
                  loop
                  playsInline
                >
                  <source src="/video/mj_video_2.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* Circular Text - Outside the circle */}
              <div className="absolute -inset-12 w-[348px] h-[348px] -top-6 -left-6">
                <svg className="w-full h-full" viewBox="0 0 348 348">
                  <defs>
                    <path
                      id="circle-path"
                      d="M 174, 174 m -160, 0 a 160,160 0 1,1 320,0 a 160,160 0 1,1 -320,0"
                    />
                  </defs>
                  <text
                    className="fill-gray-900 text-sm font-satoshi font-medium"
                    style={{ fontSize: "14px" }}
                  >
                    <textPath href="#circle-path" startOffset="0%">
                      EXPERIENCE THE FUTURE • AI POWERED DESIGN • CREATIVE TOOLS
                      • UNLIMITED POSSIBILITIES •
                    </textPath>
                  </text>
                </svg>
              </div>

              {/* Old Timey Mono Sample Text */}
              <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 text-center">
                <div className="font-old-timey text-gray-800 text-lg leading-relaxed">
                  <div className="mb-2">CREATED IN 1985</div>
                  <div className="text-sm">AUTHENTIC TERMINAL EXPERIENCE</div>
                  <div className="text-xs mt-1 text-gray-600">
                    {"> SYSTEM_READY_FOR_INPUT_"}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
