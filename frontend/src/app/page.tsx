"use client";
import React, { useRef, useState, useEffect } from "react";

// --- MODIFIED: Updated Types ---
interface Source {
  filename: string;
  text: string;
  score: number;
}

interface ChatMessage {
  sender: "user" | "ai";
  message: string;
  sources?: Source[];
}

export default function Home() {
  // Context input state
  const [contextText, setContextText] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [isIndexing, setIsIndexing] = useState(false);
  const [lastIndexedSource, setLastIndexedSource] = useState("");

  // Chat state
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll chat to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, isThinking]);

  // Handle context submission
  const handleAddContext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contextText.trim() || !sourceName.trim()) {
      alert("Please provide both a source name and text content.");
      return;
    }
    setIsIndexing(true);
    setLastIndexedSource("");
    try {
      const res = await fetch("http://localhost:8001/add-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: contextText, source_name: sourceName }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to add context");
      }
      setLastIndexedSource(`Successfully added: ${sourceName}`);
      setContextText("");
      setSourceName("");
    } catch (err: any) {
      setLastIndexedSource(`Error: ${err.message}`);
    } finally {
      setIsIndexing(false);
    }
  };

  // Chat submit logic
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setChat((prev) => [...prev, { sender: "user", message: trimmed }]);
    setInput("");
    setIsThinking(true);
    try {
      const res = await fetch("http://localhost:8001/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Query failed");
      }
      const data = await res.json();
      setChat((prev) => [
        ...prev,
        { sender: "ai", message: data.response || "(No response)", sources: data.sources },
      ]);
    } catch (err: any) {
      setChat((prev) => [
        ...prev,
        { sender: "ai", message: `Error: ${err.message}` },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center py-8 px-2">
      <div className="w-full max-w-6xl bg-neutral-900 rounded-2xl shadow-xl flex flex-col md:flex-row overflow-hidden border border-neutral-800">
        {/* Left: Context Input */}
        <div className="md:w-1/2 w-full p-8 flex flex-col gap-4 border-b md:border-b-0 md:border-r border-neutral-800">
          <h2 className="text-xl font-bold mb-2">Add to Knowledge Base</h2>
          <form onSubmit={handleAddContext} className="flex flex-col gap-4">
            <div>
              <label htmlFor="sourceName" className="block text-sm font-medium text-neutral-400 mb-1">
                Source Name
              </label>
              <input
                id="sourceName"
                type="text"
                className="w-full rounded-lg px-4 py-2 bg-neutral-800 text-neutral-100 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Project Nova Memo"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                disabled={isIndexing}
                required
              />
            </div>
            <div>
              <label htmlFor="contextText" className="block text-sm font-medium text-neutral-400 mb-1">
                Content
              </label>
              <textarea
                id="contextText"
                rows={15}
                className="w-full rounded-lg px-4 py-2 bg-neutral-800 text-neutral-100 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Paste the text content you want the AI to learn here..."
                value={contextText}
                onChange={(e) => setContextText(e.target.value)}
                disabled={isIndexing}
                required
              />
            </div>
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-lg disabled:opacity-60 transition-colors"
              disabled={isIndexing || !contextText.trim() || !sourceName.trim()}
            >
              {isIndexing ? "Indexing..." : "Add Context"}
            </button>
            {lastIndexedSource && <p className="text-sm text-neutral-400 mt-2">{lastIndexedSource}</p>}
          </form>
        </div>
        {/* Right: Chat Interface */}
        <div className="md:w-1/2 w-full flex flex-col h-[600px] p-8 gap-4">
          <h2 className="text-xl font-bold mb-2">Chat with your Knowledge Base</h2>
          <div className="flex-1 overflow-y-auto bg-neutral-950 rounded-lg p-4 border border-neutral-800 mb-2" style={{ minHeight: 0 }}>
            <div className="flex flex-col gap-3">
              {chat.map((msg, idx) => (
                <div key={idx} className={`flex flex-col w-full ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`max-w-[80%] px-4 py-2 rounded-lg text-sm whitespace-pre-line ${msg.sender === "user" ? "bg-blue-900 text-blue-100 rounded-br-none" : "bg-neutral-800 text-neutral-100 rounded-bl-none"}`}
                    >
                      {msg.message}
                    </div>
                    {/* --- MODIFIED: Detailed Source Component --- */}
                    {msg.sender === 'ai' && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 self-start w-full text-xs text-neutral-500">
                            <p className="font-bold mb-1">Sources:</p>
                            <div className="space-y-2">
                                {msg.sources.map((source, s_idx) => (
                                    <details key={s_idx} className="bg-neutral-800/50 p-2 rounded-md transition-all duration-300">
                                        <summary className="cursor-pointer font-medium text-neutral-400 hover:text-neutral-200">
                                            {source.filename} (Relevance: {(source.score * 100).toFixed(2)}%)
                                        </summary>
                                        <div className="mt-2 p-2 bg-neutral-900/70 rounded text-neutral-300 whitespace-pre-wrap font-mono text-[11px] leading-relaxed border-l-2 border-green-500">
                                            <code>{source.text}</code>
                                        </div>
                                    </details>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
              ))}
              {isThinking && (
                <div className={`max-w-[80%] px-4 py-2 rounded-lg text-sm bg-neutral-800 text-neutral-400 self-start rounded-bl-none animate-pulse`}>
                  thinking...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
          <form onSubmit={handleChatSubmit} className="flex gap-2 mt-auto">
            <input
              type="text"
              className="flex-1 rounded-lg px-4 py-2 bg-neutral-800 text-neutral-100 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type your question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isThinking}
              autoComplete="off"
              required
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg disabled:opacity-60 transition-colors"
              disabled={isThinking || !input.trim()}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

