import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Send, Plus, Upload } from 'lucide-react'
import './ChatPage.css'
import type { Project } from '../../../../../packages/shared-types/src/project.types'
import type { Document } from '../../../../../packages/shared-types/src/document.types'
import { apiFetch } from '../../lib/api'

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
  const [documents, setDocuments] = useState<Document[]>([]);

  const [isUploading, setIsUploading] = useState(false)
  const [showMetadataForm, setShowMetadataForm] = useState(false)
  const [selectedFilePath, setSelectedFilePath] = useState('')
  const [description, setDescription] = useState('')
  const [keywords, setKeywords] = useState<string[]>(['', ''])
  const [currentKeyword, setCurrentKeyword] = useState('')

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const data = await apiFetch(`projects/${project.id}/documents`);
        setDocuments(data.documents);
      } catch (error) {
        console.error("Failed to fetch documents:", error);
      }
    };
    fetchDocuments();
  }, [project.id]);

  useEffect(() => {
    console.log(`[WebSocket] Attempting to connect to project: ${project.id}`);
    const ws = new WebSocket(`ws://localhost:3001/ws/project/${project.id}`);
  
    ws.onopen = () => {
      console.log(`[WebSocket] Connection established for project ${project.id}`);
    };
  
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[WebSocket] Received message:', message);
  
        if (message.eventType && message.documentId) {
          setDocuments(currentDocs =>
            currentDocs.map(doc =>
              doc.id === message.documentId
                ? { ...doc, status: message.status }
                : doc
            )
          );
        }
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
      }
    };
  
    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };
  
    ws.onclose = () => {
      console.log('[WebSocket] Connection closed.');
    };
  
    // Cleanup function: close the connection when the component unmounts
    return () => {
      ws.close();
    };
  }, [project.id]);

  // Helper functions for managing keywords
  const addKeyword = () => {
    if (currentKeyword.trim() && keywords.length < 10 && !keywords.includes(currentKeyword.trim())) {
      setKeywords([...keywords, currentKeyword.trim()])
      setCurrentKeyword('')
    }
  }

  const removeKeyword = (index: number) => {
    const newKeywords = keywords.filter((_, i) => i !== index)
    setKeywords(newKeywords)
  }

  const updateKeyword = (index: number, value: string) => {
    const newKeywords = [...keywords]
    newKeywords[index] = value
    setKeywords(newKeywords)
  }

  const getValidKeywords = () => {
    return keywords.filter(keyword => keyword.trim() !== '')
  }

  const isMetadataValid = () => {
    const validKeywords = getValidKeywords()
    return description.trim() !== '' && validKeywords.length >= 2
  }

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
      const ragResponse = await apiFetch(`projects/${project.id}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage.content,
          topK: 5
        }),
      })
      
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
    if (!(window as any).electronAPI) {
      console.error('electronAPI not found on window object')
      alert('File upload is only available in the desktop app. Please make sure you are running the Electron version.')
      return
    }

    try {
      // Open file dialog first
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
        return
      }

      // Store the selected file path and show metadata form
      setSelectedFilePath(result.filePaths[0])
      setShowMetadataForm(true)
      // Reset form state
      setDescription('')
      setKeywords(['', ''])
      setCurrentKeyword('')
    } catch (error: any) {
      console.error('Error opening file dialog:', error)
      alert(`Failed to open file dialog: ${error.message}`)
    }
  }

  const handleSubmitMetadata = async () => {
    if (!isMetadataValid()) {
      alert('Please provide a description and at least 2 keywords.')
      return
    }

    setIsUploading(true)
    setShowMetadataForm(false)

    try {
      const originalFileName = selectedFilePath.split('/').pop() || 'unknown'
      
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
      const timestamp = Date.now()
      const destinationFileName = `${timestamp}-${originalFileName}`
      const destinationPath = `${projectDir}/${destinationFileName}`

      console.log('Copying file to:', destinationPath)

      // Copy file to project directory
      const copyResult = await (window as any).electronAPI.copyFile(selectedFilePath, destinationPath)
      
      if (!copyResult.success) {
        throw new Error(`Failed to copy file: ${copyResult.error}`)
      }

      // Send to backend for processing with metadata
      const validKeywords = getValidKeywords()
      await apiFetch(`projects/${project.id}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: destinationPath,
          fileName: originalFileName,
          description: description.trim(),
          keywords: validKeywords
        }),
      })
      
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

      {/* Document Status Section */}
      <div className="document-status-container">
        <h3>Document Status</h3>
        <div className="documents-list">
          {documents.map(doc => (
            <div key={doc.id} className="document-item">
              <span className="document-name">{doc.fileName}</span>
              <span className={`document-status-badge status-${doc.status}`}>{doc.status}</span>
            </div>
          ))}
        </div>
      </div>

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

      {/* Metadata Form Modal */}
      {showMetadataForm && (
        <div className="metadata-modal-overlay">
          <motion.div
            className="metadata-modal"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <h3>Document Information</h3>
            <p className="file-name">File: {selectedFilePath.split('/').pop()}</p>
            
            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe what this document contains..."
                rows={3}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Keywords * (minimum 2, maximum 10)</label>
              <div className="keywords-container">
                {keywords.map((keyword, index) => (
                  <div key={index} className="keyword-input-group">
                    <input
                      type="text"
                      value={keyword}
                      onChange={(e) => updateKeyword(index, e.target.value)}
                      placeholder={`Keyword ${index + 1}`}
                      className="form-input keyword-input"
                    />
                    {keywords.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeKeyword(index)}
                        className="remove-keyword-btn"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                
                {keywords.length < 10 && (
                  <div className="add-keyword-group">
                    <input
                      type="text"
                      value={currentKeyword}
                      onChange={(e) => setCurrentKeyword(e.target.value)}
                      placeholder="Add new keyword"
                      className="form-input keyword-input"
                      onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                    />
                    <button
                      type="button"
                      onClick={addKeyword}
                      disabled={!currentKeyword.trim() || keywords.includes(currentKeyword.trim())}
                      className="add-keyword-btn"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
              <p className="keyword-count">
                Valid keywords: {getValidKeywords().length}/10 (minimum 2 required)
              </p>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => setShowMetadataForm(false)}
                className="cancel-btn"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitMetadata}
                disabled={!isMetadataValid() || isUploading}
                className="submit-btn"
              >
                {isUploading ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

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