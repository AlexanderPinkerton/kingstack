"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";

export function FeaturesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const features = [
    {
      title: "Highlighted Feature 1",
      description:
        "Feature description goes here explaining the benefit and value proposition.",
      isLarge: true,
    },
    {
      title: "Highlighted Feature 2",
      description:
        "Feature description goes here explaining the benefit and value proposition.",
      isLarge: false,
    },
    {
      title: "Highlighted Feature 3",
      description:
        "Feature description goes here explaining the benefit and value proposition.",
      isLarge: false,
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" as const },
    },
  };

  return (
    <section ref={ref} className="w-full px-6 py-20 bg-cream-100">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: "easeOut" as const }}
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Features Section
          </h2>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          <div className="space-y-8">
            <motion.div
              className="bg-cream-100 rounded-lg shadow-sm border p-6"
              variants={itemVariants}
              whileHover={{ scale: 1.02, y: -5 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Highlight what sets your app apart from others
              </h3>
              <p className="text-gray-600 text-sm">
                Use punchy copy to explain value and easy to quickly show how
                your features live problems.
              </p>
            </motion.div>

            <motion.div
              className="bg-gray-50 rounded-2xl p-8 min-h-[300px] flex items-center justify-center"
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center space-y-4">
                <motion.div
                  className="w-16 h-16 bg-gray-200 rounded-lg mx-auto"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={
                    isInView
                      ? { scale: 1, rotate: 0 }
                      : { scale: 0, rotate: -180 }
                  }
                  transition={{
                    duration: 0.5,
                    delay: 0.6,
                    type: "spring",
                    stiffness: 200,
                  }}
                  whileHover={{ rotate: 10, scale: 1.1 }}
                />
                <motion.h3
                  className="text-xl font-bold text-gray-900"
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                >
                  {features[0].title}
                </motion.h3>
                <motion.p
                  className="text-gray-600"
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.6, delay: 1.0 }}
                >
                  {features[0].description}
                </motion.p>
              </div>
            </motion.div>
          </div>

          <div className="space-y-8">
            {features.slice(1).map((feature, index) => (
              <motion.div
                key={index}
                className="bg-gray-50 rounded-2xl p-8 min-h-[200px] flex items-center justify-center"
                variants={itemVariants}
                whileHover={{ scale: 1.02, rotate: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-center space-y-4">
                  <motion.div
                    className="w-12 h-12 bg-gray-200 rounded-lg mx-auto"
                    initial={{ scale: 0, rotate: 180 }}
                    animate={
                      isInView
                        ? { scale: 1, rotate: 0 }
                        : { scale: 0, rotate: 180 }
                    }
                    transition={{
                      duration: 0.5,
                      delay: 0.8 + index * 0.2,
                      type: "spring",
                      stiffness: 200,
                    }}
                    whileHover={{ rotate: -10, scale: 1.15 }}
                  />
                  <motion.h3
                    className="text-lg font-bold text-gray-900"
                    initial={{ opacity: 0, y: 20 }}
                    animate={
                      isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                    }
                    transition={{ duration: 0.6, delay: 1.0 + index * 0.2 }}
                  >
                    {feature.title}
                  </motion.h3>
                  <motion.p
                    className="text-gray-600 text-sm"
                    initial={{ opacity: 0, y: 20 }}
                    animate={
                      isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                    }
                    transition={{ duration: 0.6, delay: 1.2 + index * 0.2 }}
                  >
                    {feature.description}
                  </motion.p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
