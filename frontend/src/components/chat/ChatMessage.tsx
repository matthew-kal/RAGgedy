import React from "react";
import { motion } from "framer-motion";
import { Bot, User, Star } from "lucide-react";
import clsx from "clsx";
import { ChatMessage as ChatMessageType } from "../../types";
import { chatVariants } from "../../config/animations";

interface ChatMessageProps {
  message: ChatMessageType;
  index: number;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, index }) => {
  return (
    <motion.div
      key={index}
      className={clsx(
        "chat-bubble flex flex-col",
        message.sender === 'user' ? 'items-end' : 'items-start'
      )}
      variants={chatVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      layout
    >
      <div className="flex items-center gap-2 mb-2">
        {message.sender === 'user' ? (
          <User className="w-4 h-4 text-blue-400" />
        ) : (
          <Bot className="w-4 h-4 text-purple-400" />
        )}
        <span className="text-xs text-gray-400">
          {message.timestamp.toLocaleTimeString()}
        </span>
      </div>
      
      <motion.div
        className={clsx(
          "max-w-[85%] p-4 rounded-2xl text-sm relative overflow-hidden",
          message.sender === "user" 
            ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-br-none" 
            : "glass text-gray-100 rounded-bl-none"
        )}
        whileHover={{ scale: 1.02 }}
      >
        <p className="whitespace-pre-wrap">{message.message}</p>
      </motion.div>
      
      {/* Sources */}
      {message.sender === 'ai' && message.sources && message.sources.length > 0 && (
        <motion.div 
          className="mt-3 w-full max-w-[85%] space-y-2"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
        >
          <p className="text-xs text-gray-400 font-semibold mb-2">Sources:</p>
          {message.sources.map((source, s_idx) => (
            <motion.details 
              key={s_idx} 
              className="glass p-3 rounded-lg text-xs group cursor-pointer"
              whileHover={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            >
              <summary className="flex items-center justify-between font-medium text-gray-300 hover:text-white">
                <span className="flex items-center gap-2">
                  <Star className="w-3 h-3 text-yellow-400" />
                  {source.filename}
                </span>
                <span className="text-green-400">
                  {(source.score * 100).toFixed(1)}%
                </span>
              </summary>
              <motion.div 
                className="mt-2 p-2 bg-black/20 rounded text-gray-300 font-mono text-[10px] leading-relaxed border-l-2 border-blue-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {source.text}
              </motion.div>
            </motion.details>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}; 