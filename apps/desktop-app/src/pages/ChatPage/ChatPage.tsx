import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Send, Plus, Upload } from 'lucide-react'
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

  const [isUploading, setIsUploading] = useState(false)

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

    // Query the RAG system
    try {
      const response = await fetch(`http://localhost:3001/projects/${project.id}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage.content,
          topK: 5
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to query documents')
      }

      const ragResponse = await response.json()
      
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        content: ragResponse.answer || "I couldn't find relevant information in your documents to answer that question.",
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiMessage])
    } catch (error: any) {
      console.error('RAG query failed:', error)
      
      const errorMessage: Message = {
        id: `ai-error-${Date.now()}`,
        content: "I'm having trouble accessing your documents right now. Please make sure the backend server is running and try again.",
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleUploadFile = async () => {
    console.log('handleUploadFile called')
    console.log('window object keys:', Object.keys(window))
    console.log('window.electronAPI:', (window as any).electronAPI)
    
    // Test if we can access the API
    try {
      if ((window as any).electronAPI && (window as any).electronAPI.getHomeDirectory) {
        console.log('Testing getHomeDirectory...')
        const homeDir = await (window as any).electronAPI.getHomeDirectory()
        console.log('Home directory:', homeDir)
      }
    } catch (error) {
      console.error('Error testing electronAPI:', error)
    }
    
    if (!(window as any).electronAPI) {
      console.error('electronAPI not found on window object')
      alert('File upload is only available in the desktop app. Please make sure you are running the Electron version.')
      return
    }

    setIsUploading(true)

    try {
      // Open file dialog
      const result = await (window as any).electronAPI.openFileDialog({
        title: 'Select document to upload',
        filters: [
          { name: 'All Supported', extensions: ['pdf', 'docx', 'png', 'jpeg', 'jpg', 'csv', 'txt', 'md', 'html'] },
          { name: 'Documents', extensions: ['pdf', 'docx', 'txt', 'md', 'html'] },
          { name: 'Images', extensions: ['png', 'jpeg', 'jpg'] },
          { name: 'Data', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        setIsUploading(false)
        return
      }

      const selectedFilePath = result.filePaths[0]
      
      // Get home directory
      const homeDir = await (window as any).electronAPI.getHomeDirectory()
      
      // Create raggedy directory in home folder
      const raggedyDir = `${homeDir}/raggedy`
      const createDirResult = await (window as any).electronAPI.createDirectory(raggedyDir)
      
      if (!createDirResult.success) {
        throw new Error(`Failed to create raggedy directory: ${createDirResult.error}`)
      }

      // Create project-specific directory
      const projectDir = `${raggedyDir}/${project.id}`
      const createProjectDirResult = await (window as any).electronAPI.createDirectory(projectDir)
      
      if (!createProjectDirResult.success) {
        throw new Error(`Failed to create project directory: ${createProjectDirResult.error}`)
      }

      // Generate destination filename
      const originalFileName = selectedFilePath.split('/').pop() || 'unknown'
      const timestamp = Date.now()
      const destinationFileName = `${timestamp}-${originalFileName}`
      const destinationPath = `${projectDir}/${destinationFileName}`

      console.log('Copying file to:', destinationPath)

      // Copy file to project directory
      const copyResult = await (window as any).electronAPI.copyFile(selectedFilePath, destinationPath)
      
      if (!copyResult.success) {
        throw new Error(`Failed to copy file: ${copyResult.error}`)
      }

      // Send to backend for processing
      const response = await fetch(`http://localhost:3001/projects/${project.id}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: destinationPath,
          description: '', // Could add a description input later
          keywords: []
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload document')
      }

      await response.json()
      
      // Add success message to chat
      const successMessage: Message = {
        id: `upload-success-${Date.now()}`,
        content: `Successfully uploaded "${originalFileName}" for processing. The document will be available for queries once processing is complete.`,
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, successMessage])
      
    } catch (error: any) {
      console.error('Upload failed:', error)
      
      // Add error message to chat
      const errorMessage: Message = {
        id: `upload-error-${Date.now()}`,
        content: `Failed to upload document: ${error.message}`,
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsUploading(false)
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

        <div className="flex gap-2">
          <motion.button
            className="test-api-button glass-effect-subtle"
            onClick={() => {
              console.log('Testing electronAPI...')
              console.log('Available on window:', (window as any).electronAPI)
              if ((window as any).electronAPI) {
                console.log('API methods:', Object.keys((window as any).electronAPI))
              }
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Test API
          </motion.button>
          
          <motion.button
            className="add-docs-button glass-effect"
            onClick={handleUploadFile}
            disabled={isUploading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isUploading ? <Upload className="animate-pulse" size={20} /> : <Plus size={20} />}
            {isUploading ? 'Uploading...' : 'Add Documents'}
          </motion.button>
        </div>
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