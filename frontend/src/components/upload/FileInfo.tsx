import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { File } from "lucide-react";

interface FileInfoProps {
  file: File | null;
  className?: string;
}

export const FileInfo: React.FC<FileInfoProps> = ({ file, className = "" }) => {
  if (!file) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`glass p-4 rounded-lg ${className}`}
      >
        <div className="flex items-center gap-3">
          <File className="w-8 h-8 text-blue-400" />
          <div>
            <p className="font-semibold">{file.name}</p>
            <p className="text-sm text-gray-400">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}; 