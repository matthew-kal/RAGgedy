import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, Loader2, Clock } from "lucide-react";

interface StatusMessageProps {
  message: string;
  type: "loading" | "success" | "error" | "info";
  className?: string;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({
  message,
  type,
  className = ""
}) => {
  const getIcon = () => {
    switch (type) {
      case "loading":
        return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case "info":
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return null;
    }
  };

  const getBackground = () => {
    switch (type) {
      case "success":
        return "bg-green-500/20 border-green-500/50";
      case "error":
        return "bg-red-500/20 border-red-500/50";
      case "info":
        return "bg-yellow-500/20 border-yellow-500/50";
      case "loading":
      default:
        return "glass";
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`${getBackground()} ${type === "error" ? "border" : ""} p-4 rounded-lg ${className}`}
      >
        <div className="flex items-center gap-2">
          {getIcon()}
          <p className={`text-sm ${type === "error" ? "text-red-300" : ""}`}>
            {message}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}; 