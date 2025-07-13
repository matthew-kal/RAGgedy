import React, { useRef } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { ACCEPTED_FILE_TYPES, ACCEPTED_EXTENSIONS } from "../../config/constants";

interface UploadZoneProps {
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (file: File) => void;
  className?: string;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  className = ""
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <motion.div
        className={clsx(
          "upload-zone border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300",
          isDragOver 
            ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/25" 
            : "border-gray-600 hover:border-gray-500 hover:bg-white/5",
          className
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={handleClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <motion.div 
          className="space-y-4"
          animate={isDragOver ? { scale: 1.1 } : { scale: 1 }}
        >
          <motion.div 
            className="text-6xl mb-4"
            animate={{ rotate: isDragOver ? 360 : 0 }}
            transition={{ duration: 0.5 }}
          >
            📁
          </motion.div>
          <div>
            <p className="text-xl font-semibold mb-2">
              {isDragOver ? "Drop your file here!" : "Drag & drop or click to select"}
            </p>
            <p className="text-gray-400 text-sm">
              Maximum file size: 100MB
            </p>
          </div>
          
          {/* Supported formats */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {ACCEPTED_EXTENSIONS.map(({ ext, icon: Icon, color }) => (
              <motion.div
                key={ext}
                className="flex items-center gap-1 px-3 py-1 bg-white/10 rounded-full text-xs"
                whileHover={{ scale: 1.1 }}
              >
                <Icon className={clsx("w-3 h-3", color)} />
                <span className={color}>{ext}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
      />
    </>
  );
}; 