import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Send, Plus } from 'lucide-react'
import './ChatPage.css'
import type { Project } from 'shared-types'

interface ChatPageProps {
  project: Project
  onBack: () => void
}

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
}

const ChatPage: React.FC<ChatPageProps> = ({ project, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Initialize with a welcome message
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      content: `Welcome to ${project.name}! I'm ready to help you with your documents and answer any questions you might have.`,
      isUser: false,
      timestamp: new Date()
    }
    setMessages([welcomeMessage])
  }, [project.name])

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: inputValue.trim(),
      isUser: true,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // Simulate AI response (replace with actual RAG implementation later)
    setTimeout(() => {
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        content: `I understand you're asking about "${userMessage.content}". This is where the RAG system will provide intelligent responses based on your project documents.`,
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiMessage])
      setIsLoading(false)
    }, 1000)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <motion.div
      className="chat-page"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Header */}
      <header className="chat-header">
        <motion.button
          className="back-button glass-effect-subtle"
          onClick={onBack}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft size={20} />
        </motion.button>
        
        <div className="project-info">
          <h1 className="project-title">{project.name}</h1>
          <p className="project-meta">{project.documentCount} documents • {project.description}</p>
        </div>

        <motion.button
          className="add-docs-button glass-effect"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Plus size={20} />
          Add Documents
        </motion.button>
      </header>

      {/* Chat Messages */}
      <main className="chat-main">
        <div className="messages-container">
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              className={`message ${message.isUser ? 'user' : 'ai'}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <div className={`message-content ${message.isUser ? 'glass-effect' : 'glass-effect-subtle'}`}>
                <p>{message.content}</p>
                <span className="message-time">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
          
          {isLoading && (
            <motion.div
              className="message ai"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="message-content glass-effect-subtle">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Input Area */}
      <footer className="chat-footer">
        <div className="input-container glass-effect-subtle">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about your documents..."
            className="chat-input"
            rows={1}
          />
          <motion.button
            className="send-button"
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Send size={20} />
          </motion.button>
        </div>
      </footer>
    </motion.div>
  )
}

export default ChatPage
