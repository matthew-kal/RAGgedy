import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot } from "lucide-react";

interface TypingIndicatorProps {
  isVisible: boolean;
  isTyping: boolean;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  isVisible, 
  isTyping 
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-center gap-2 glass p-4 rounded-2xl rounded-bl-none max-w-[85%]"
        >
          <Bot className="w-4 h-4 text-purple-400" />
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <span className="text-sm text-gray-400">
            {isTyping ? 'Typing...' : 'Thinking...'}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}; 