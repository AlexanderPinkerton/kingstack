"use client";

/** @paper-design/shaders-react@0.0.62 */
import { GrainGradient as GrainGradient1 } from "@paper-design/shaders-react";

/**
 * Code exported from Paper
 * https://app.paper.design/file/01K66HGEQ4FXTTY6A37TS4MNHB?node=01K9WX4EKR5337NPKZS7GQNVY3
 * on Nov 12, 2025 at 3:52 PM.
 */
export default function GrainGradient() {
  return (
    <div className="relative w-full h-full">
      {/* Base layer */}
      <GrainGradient1
        colors={["#FCF58F", "#FDCF74", "#00BFFF", "#FFFFFF"]}
        colorBack="#00000000"
        speed={1.48}
        scale={2.15}
        rotation={-75}
        offsetX={0}
        offsetY={0}
        softness={0}
        intensity={0}
        noise={0}
        shape="blob"
        frame={6441.199999928474}
        style={{
          backgroundColor: "#FFFFFF",
          height: "100vh",
          width: "100vw",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />
      {/* Top layer - 60% opacity, rotated 180 degrees */}
      <GrainGradient1
        colors={["#FCF58F", "#FDCF74", "#00BFFF", "#FFFFFF"]}
        colorBack="#00000000"
        speed={1.48}
        scale={2.15}
        rotation={105}
        offsetX={0}
        offsetY={0}
        softness={0}
        intensity={0}
        noise={0}
        shape="blob"
        frame={6441.199999928474}
        style={{
          backgroundColor: "transparent",
          height: "100vh",
          width: "100vw",
          position: "absolute",
          top: 0,
          left: 0,
          opacity: 0.6,
        }}
      />
    </div>
  );
}
