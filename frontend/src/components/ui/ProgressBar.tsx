import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ProgressBarProps {
  progress: number;
  className?: string;
  showPercentage?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  className = "",
  showPercentage = true
}) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`space-y-2 ${className}`}
      >
        <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        {showPercentage && (
          <p className="text-sm text-gray-400 text-center">
            {Math.round(progress)}% complete
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}; 