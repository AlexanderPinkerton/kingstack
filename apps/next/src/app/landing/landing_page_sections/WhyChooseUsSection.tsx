"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";

export function WhyChooseUsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const reasons = [
    {
      icon: "?",
      title: "Title",
      description: "Brief explanation of this benefit",
    },
    {
      icon: "?",
      title: "Title",
      description: "Brief explanation of this benefit",
    },
    {
      icon: "?",
      title: "Title",
      description: "Brief explanation of this benefit",
    },
    {
      icon: "?",
      title: "Title",
      description: "Brief explanation of this benefit",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.5, ease: "easeOut" as const },
    },
  };

  return (
    <section ref={ref} className="w-full px-6 py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: "easeOut" as const }}
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Why Choose Us Section
          </h2>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {reasons.map((reason, index) => (
            <motion.div
              key={index}
              className="text-center space-y-4"
              variants={itemVariants}
              whileHover={{ y: -10, scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className="w-16 h-16 bg-cream-100 rounded-lg shadow-sm border flex items-center justify-center mx-auto"
                whileHover={{ rotate: 360, scale: 1.1 }}
                transition={{ duration: 0.5 }}
              >
                <motion.span
                  className="text-gray-400 text-xl font-bold"
                  initial={{ scale: 0 }}
                  animate={isInView ? { scale: 1 } : { scale: 0 }}
                  transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
                >
                  {reason.icon}
                </motion.span>
              </motion.div>
              <motion.h3
                className="text-lg font-semibold text-gray-900"
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
              >
                {reason.title}
              </motion.h3>
              <motion.p
                className="text-gray-600 text-sm"
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.5, delay: 0.9 + index * 0.1 }}
              >
                {reason.description}
              </motion.p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, delay: 1.2 }}
        >
          <motion.div
            className="bg-cream-100 rounded-lg shadow-sm border p-6 inline-block"
            whileHover={{ scale: 1.02, y: -5 }}
            transition={{ duration: 0.2 }}
          >
            <p className="text-sm text-gray-600 mb-2">
              Make your strengths obvious.
            </p>
            <p className="text-sm text-gray-600">
              Use icons, brief titles, and benefit-led
            </p>
            <p className="text-sm text-gray-600">
              text to explain why users should pick
            </p>
            <p className="text-sm text-gray-600">your app over others.</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
