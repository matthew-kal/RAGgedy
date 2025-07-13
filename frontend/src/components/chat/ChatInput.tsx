import React from "react";
import { Send } from "lucide-react";
import { Button } from "../ui/Button";

interface ChatInputProps {
  input: string;
  setInput: (input: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isThinking: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  onSubmit,
  isThinking
}) => {
  return (
    <div className="p-6 border-t border-white/10">
      <form onSubmit={onSubmit} className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ask me anything about your documents..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isThinking}
            autoComplete="off"
          />
        </div>
        <Button
          type="submit"
          disabled={isThinking || !input.trim()}
          variant="gradient"
          icon={<Send className="w-5 h-5" />}
        />
      </form>
    </div>
  );
}; 