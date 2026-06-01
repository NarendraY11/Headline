import { motion } from "framer-motion";
import React, { Suspense } from "react";

import { LoadingFallback } from './LoadingFallback';

export function PageTransition({ children, keyId }: { children: React.ReactNode, keyId?: string }) {
  return (
    <motion.div
      key={keyId}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="w-full h-full"
    >
      <Suspense fallback={<LoadingFallback />}>
        {children}
      </Suspense>
    </motion.div>
  );
}
