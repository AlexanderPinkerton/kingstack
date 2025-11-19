"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useState } from "react";

// Wave Animation Component
interface Dot {
  id: number;
  x: number;
  y: number;
}

interface WaveAnimationProps {
  color?: string;
  rotation?: number;
}

function WaveAnimation({ color = "black", rotation = 0 }: WaveAnimationProps) {
  const [dots] = useState<Dot[]>(() => {
    const gridSize = 38; // Reduced by 50% (54*54 = 2,916, now 38*38 = 1,444)
    const newDots: Dot[] = [];

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        newDots.push({
          id: i * gridSize + j,
          x: j,
          y: i,
        });
      }
    }

    return newDots;
  });

  const getDotAnimation = (dot: Dot) => {
    const centerX = 19; // Adjusted for new grid size (38/2)
    const centerY = 19;
    const distance = Math.sqrt((dot.x - centerX) ** 2 + (dot.y - centerY) ** 2);

    let colors, initialColor;

    switch (color) {
      case "orange":
      case "white":
      case "grey":
        colors = ["#6b7280", "#9ca3af", "#6b7280", "#9ca3af", "#6b7280"];
        initialColor = "#6b7280";
        break;
      case "orange-light":
        colors = ["#fb923c", "#fdba74", "#fb923c", "#fdba74", "#fb923c"];
        initialColor = "#fb923c";
        break;
      case "orange-dark":
        colors = ["#ea580c", "#f97316", "#ea580c", "#f97316", "#ea580c"];
        initialColor = "#ea580c";
        break;
      case "orange-400":
        colors = ["#fb923c", "#fdba74", "#fb923c", "#fdba74", "#fb923c"];
        initialColor = "#fb923c";
        break;
      case "orange-300":
        colors = ["#fdba74", "#fcd34d", "#fdba74", "#fcd34d", "#fdba74"];
        initialColor = "#fdba74";
        break;
      default:
        colors = ["#000000", "#374151", "#000000", "#374151", "#000000"];
        initialColor = "#000000";
        break;
    }

    return {
      scale: [1, 1.8, 1, 1.8, 1],
      backgroundColor: colors,
      y: [0, -15, 0, -15, 0],
      transition: {
        duration: 3,
        delay: distance * 0.08,
        ease: "easeInOut" as const,
        repeat: Infinity,
        repeatType: "loop" as const,
      },
    };
  };

  return (
    <div
      className="w-full h-full absolute inset-0 flex items-center justify-center "
      style={{
        transform: `rotate(${rotation}deg)`,
        transformOrigin: "center center",
      }}
    >
      <div className="relative" style={{ width: "400px", height: "400px" }}>
        {dots.map((dot) => {
          const { initialColor } = (() => {
            switch (color) {
              case "orange":
              case "white":
              case "grey":
                return { initialColor: "#6b7280" };
              case "orange-light":
                return { initialColor: "#fb923c" };
              case "orange-dark":
                return { initialColor: "#ea580c" };
              case "orange-400":
                return { initialColor: "#fb923c" };
              case "orange-300":
                return { initialColor: "#fdba74" };
              default:
                return { initialColor: "#000000" };
            }
          })();

          return (
            <motion.div
              key={dot.id}
              className="absolute rounded-full"
              style={{
                width: "3px",
                height: "3px",
                left: dot.x * 8 + 50,
                top: dot.y * 8 + 50,
                backgroundColor: initialColor,
              }}
              initial={{ scale: 1, opacity: 0.8 }}
              animate={getDotAnimation(dot)}
            />
          );
        })}
      </div>
    </div>
  );
}

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

            {/* Commented out wave animations */}
            {/* <div className="absolute inset-0">
            <WaveAnimation color="orange-400" rotation={0} />
          </div>

          <div className="absolute inset-0 bg-transparent">
            <WaveAnimation color="orange-300" rotation={45} />
          </div> */}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
