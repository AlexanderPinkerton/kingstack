"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";

export function ReviewsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const reviews = [
    {
      rating: 5,
      name: "Name",
      company: "Company",
      content: "Brief testimonial content goes here...",
    },
    {
      rating: 5,
      name: "Name",
      company: "Company",
      content: "Brief testimonial content goes here...",
    },
    {
      rating: 5,
      name: "Name",
      company: "Company",
      content: "Brief testimonial content goes here...",
    },
  ];

  const StarRating = ({
    rating,
    delay = 0,
  }: {
    rating: number;
    delay?: number;
  }) => (
    <div className="flex space-x-1">
      {[...Array(5)].map((_, i) => (
        <motion.span
          key={i}
          className={`text-sm ${i < rating ? "text-yellow-400" : "text-gray-300"}`}
          initial={{ opacity: 0, scale: 0, rotate: -180 }}
          animate={
            isInView
              ? { opacity: 1, scale: 1, rotate: 0 }
              : { opacity: 0, scale: 0, rotate: -180 }
          }
          transition={{
            duration: 0.3,
            delay: delay + i * 0.1,
            type: "spring",
            stiffness: 200,
          }}
          whileHover={{ scale: 1.3, rotate: 360 }}
        >
          ★
        </motion.span>
      ))}
    </div>
  );

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
    hidden: { opacity: 0, y: 30, rotateY: -20 },
    visible: {
      opacity: 1,
      y: 0,
      rotateY: 0,
      transition: { duration: 0.6, ease: "easeOut" as const },
    },
  };

  return (
    <section ref={ref} className="w-full px-6 py-20 bg-cream-100">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="flex items-start justify-between mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: "easeOut" as const }}
        >
          <div className="space-y-4">
            <h2 className="text-4xl font-bold text-gray-900">Review Section</h2>
            <motion.div
              className="bg-cream-100 rounded-lg shadow-sm border p-6 max-w-md"
              initial={{ opacity: 0, x: -30 }}
              animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              whileHover={{ scale: 1.02, y: -5 }}
            >
              <p className="text-sm text-gray-600 mb-2">
                Let happy users convince the rest.
              </p>
              <p className="text-sm text-gray-600">
                Testimonials with names, ratings, and
              </p>
              <p className="text-sm text-gray-600">
                short blurbs help build authenticity and
              </p>
              <p className="text-sm text-gray-600">trust.</p>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {reviews.map((review, index) => (
            <motion.div
              key={index}
              className="bg-gray-50 rounded-lg p-6 space-y-4"
              variants={itemVariants}
              whileHover={{
                scale: 1.05,
                y: -10,
                boxShadow:
                  "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              }}
              transition={{ duration: 0.2 }}
            >
              <StarRating rating={review.rating} delay={0.5 + index * 0.2} />
              <motion.p
                className="text-gray-700 text-sm leading-relaxed"
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.6, delay: 0.8 + index * 0.2 }}
              >
                {review.content}
              </motion.p>
              <motion.div
                className="border-t pt-4"
                initial={{ opacity: 0, y: 20 }}
                animate={
                  isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                }
                transition={{ duration: 0.5, delay: 1.0 + index * 0.2 }}
              >
                <p className="font-semibold text-gray-900 text-sm">
                  {review.name}
                </p>
                <p className="text-gray-600 text-xs">{review.company}</p>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
