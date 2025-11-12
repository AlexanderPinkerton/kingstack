"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";

export function AccordionDemo() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const accordionItems = [
    {
      value: "item-1",
      question: "Product Information",
      content: [
        "Our flagship product combines cutting-edge technology with sleek design. Built with premium materials, it offers unparalleled performance and reliability.",
        "Key features include advanced processing capabilities, and an intuitive user interface designed for both beginners and experts.",
      ],
    },
    {
      value: "item-2",
      question: "Shipping Details",
      content: [
        "We offer worldwide shipping through trusted courier partners. Standard delivery takes 3-5 business days, while express shipping ensures delivery within 1-2 business days.",
        "All orders are carefully packaged and fully insured. Track your shipment in real-time through our dedicated tracking portal.",
      ],
    },
    {
      value: "item-3",
      question: "Return Policy",
      content: [
        "We stand behind our products with a comprehensive 30-day return policy. If you're not completely satisfied, simply return the item in its original condition.",
        "Our hassle-free return process includes free return shipping and full refunds processed within 48 hours of receiving the returned item.",
      ],
    },
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.8, ease: "easeOut" as const }}
    >
      <Accordion
        type="single"
        collapsible
        className="w-full"
        defaultValue="item-1"
      >
        {accordionItems.map((item, index) => (
          <motion.div
            key={item.value}
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
            transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
          >
            <AccordionItem value={item.value}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4 text-balance">
                {item.content.map((paragraph, pIndex) => (
                  <motion.p
                    key={pIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.3 + pIndex * 0.1 }}
                  >
                    {paragraph}
                  </motion.p>
                ))}
              </AccordionContent>
            </AccordionItem>
          </motion.div>
        ))}
      </Accordion>
    </motion.div>
  );
}

export function FAQSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="w-full px-6 py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: "easeOut" as const }}
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">FAQ Section</h2>
        </motion.div>

        <motion.div
          className="flex items-start justify-between gap-12"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="flex-1">
            <AccordionDemo />
          </div>

          <motion.div
            className="bg-cream-100 rounded-lg shadow-sm border p-6 max-w-sm"
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            whileHover={{ scale: 1.02, y: -5 }}
          >
            <h3 className="font-semibold text-gray-900 mb-2">
              Reduce hesitation with smart answers.
            </h3>
            <p className="text-sm text-gray-600">
              Use collapsible questions to address common concerns without
              overwhelming the UI layout.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
