import React from 'react';
import { motion, useScroll, useSpring } from 'motion/react';

export default function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[3px] bg-navy z-[9999] origin-left drop-shadow-[0_0_4px_rgba(20,48,90,0.5)]"
      style={{ scaleX }}
    />
  );
}
