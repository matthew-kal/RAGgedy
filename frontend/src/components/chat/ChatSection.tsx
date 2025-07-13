import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { TypingIndicator } from "./TypingIndicator";
import { ChatMessage as ChatMessageType } from "../../types";
import { itemVariants } from "../../config/animations";

interface ChatSectionProps {
  chat: ChatMessageType[];
  input: string;
  setInput: (input: string) => void;
  isThinking: boolean;
  isTyping: boolean;
  onChatSubmit: (e: React.FormEvent) => void;
}

export const ChatSection: React.FC<ChatSectionProps> = ({
  chat,
  input,
  setInput,
  isThinking,
  isTyping,
  onChatSubmit
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, isThinking]);

  return (
    <motion.div 
      className="lg:w-1/2 flex flex-col h-full"
      variants={itemVariants}
    >
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-6 h-6 text-blue-400" />
          <h2 className="text-2xl font-bold">Chat with AI</h2>
        </div>
      </div>
      
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {chat.map((msg, idx) => (
            <ChatMessage key={idx} message={msg} index={idx} />
          ))}
        </AnimatePresence>
        
        <TypingIndicator 
          isVisible={isThinking || isTyping}
          isTyping={isTyping}
        />
        
        <div ref={chatEndRef} />
      </div>
      
      <ChatInput
        input={input}
        setInput={setInput}
        onSubmit={onChatSubmit}
        isThinking={isThinking}
      />
    </motion.div>
  );
}; 