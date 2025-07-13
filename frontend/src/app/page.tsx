"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { Sparkles, Brain } from "lucide-react";
import Particles from "react-particles";
import { loadSlim } from "tsparticles-slim";
import type { Container, Engine } from "tsparticles-engine";

// Import types, config, and components
import { ChatMessage, DocumentStatus } from "../types";
import { particlesConfig } from "../config/particles";
import { pageVariants, containerVariants, itemVariants } from "../config/animations";
import { MAX_STATUS_ATTEMPTS, STATUS_POLL_INTERVAL } from "../config/constants";
import { UploadSection } from "../components/upload/UploadSection";
import { ChatSection } from "../components/chat/ChatSection";



export default function Home() {
  // --- STATE ---
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [currentDocumentKey, setCurrentDocumentKey] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  
  // Chat state
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  // --- PARTICLE SETUP ---
  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  const particlesLoaded = useCallback(async (container: Container | undefined) => {
    console.log("Particles loaded");
  }, []);

  // --- EFFECTS ---
  useEffect(() => {
    if (isUploading) {
      const interval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + Math.random() * 15, 90));
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isUploading]);

  // --- HELPER FUNCTIONS ---
  const handleValidationError = (error: string) => {
    setErrorMessage(error);
  };

  const handleStatusChange = (status: string) => {
    setUploadStatus(status);
  };

  // --- STATUS POLLING ---
  const pollStatus = async (documentKey: string) => {
    const maxAttempts = MAX_STATUS_ATTEMPTS;
    let attempts = 0;
    
    const poll = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/status/${documentKey}`);
        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }
        
        const status: DocumentStatus = await response.json();
        
        if (status.status === 'processing') {
          setUploadStatus('🧠 AI is analyzing your document...');
          attempts++;
          
          if (attempts < maxAttempts) {
            setTimeout(poll, STATUS_POLL_INTERVAL);
          } else {
            setUploadStatus('⏱️ Processing timeout - check back later');
            setIsUploading(false);
            setUploadProgress(0);
            toast.error('Processing timeout');
          }
        } else if (status.status === 'complete') {
          setUploadStatus(`✨ Document processed successfully! ${status.chunks_processed || 0} chunks indexed`);
          setIsUploading(false);
          setUploadProgress(100);
          setFileToUpload(null);
          setCurrentDocumentKey('');
          toast.success('Document processed successfully!', {
            icon: '✨',
            duration: 4000,
          });
        } else if (status.status === 'error') {
          setUploadStatus(`❌ Processing failed: ${status.error_message || 'Unknown error'}`);
          setIsUploading(false);
          setUploadProgress(0);
          toast.error(`Processing failed: ${status.error_message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error polling status:', error);
        attempts++;
        
        if (attempts < maxAttempts) {
          setTimeout(poll, STATUS_POLL_INTERVAL);
        } else {
          setUploadStatus('❌ Error checking status');
          setIsUploading(false);
          setUploadProgress(0);
          toast.error('Error checking status');
        }
      }
    };
    
    poll();
  };

  // --- UPLOAD HANDLER ---
  const handleUpload = async () => {
    if (!fileToUpload) return;
    
    setIsUploading(true);
    setErrorMessage('');
    setUploadProgress(0);
    
    const uploadToast = toast.loading('Preparing upload...', {
      icon: '⚡',
    });
    
    try {
      // Step 1: Get presigned URL
      setUploadStatus('⚡ Preparing upload...');
      setUploadProgress(10);
      
      const presignedResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate-upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: fileToUpload.name,
          contentType: fileToUpload.type
        })
      });
      
      if (!presignedResponse.ok) {
        const errorData = await presignedResponse.json();
        throw new Error(errorData.error || 'Failed to get upload URL');
      }
      
      const presignedData = await presignedResponse.json();
      setCurrentDocumentKey(presignedData.document_key);
      
      // Step 2: Upload to S3
      setUploadStatus('🚀 Uploading to cloud...');
      setUploadProgress(30);
      
      const formData = new FormData();
      Object.entries(presignedData.fields).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
      formData.append('file', fileToUpload);
      
      const uploadResponse = await fetch(presignedData.url, {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }
      
      setUploadProgress(60);
      toast.dismiss(uploadToast);
      toast.success('Upload complete! Processing...', {
        icon: '🧠',
      });
      
      // Step 3: Start status polling
      setUploadStatus('🧠 AI is processing your document...');
      pollStatus(presignedData.document_key);
      
    } catch (error: any) {
      console.error('Upload error:', error);
      setErrorMessage(`Upload failed: ${error.message}`);
      setUploadStatus('');
      setIsUploading(false);
      setUploadProgress(0);
      toast.dismiss(uploadToast);
      toast.error(`Upload failed: ${error.message}`);
    }
  };

  // --- CHAT HANDLERS ---
  const simulateTyping = (message: string, callback: () => void) => {
    setIsTyping(true);
    const typingDuration = Math.min(message.length * 30, 3000);
    setTimeout(() => {
      setIsTyping(false);
      callback();
    }, typingDuration);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;
    
    const userMessage: ChatMessage = {
      sender: "user",
      message: trimmed,
      timestamp: new Date()
    };
    
    setChat(prev => [...prev, userMessage]);
    setInput("");
    setIsThinking(true);
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Query failed");
      }
      
      const data = await res.json();
      
      simulateTyping(data.response, () => {
        const aiMessage: ChatMessage = {
          sender: "ai",
          message: data.response || "(No response)",
          sources: data.sources,
          timestamp: new Date()
        };
        setChat(prev => [...prev, aiMessage]);
      });
      
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        sender: "ai",
        message: `Error: ${err.message}`,
        timestamp: new Date()
      };
      setChat(prev => [...prev, errorMessage]);
      toast.error(`Query failed: ${err.message}`);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <motion.div 
      className="min-h-screen aurora-bg text-white relative overflow-hidden"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Particle Background */}
      <Particles
        id="tsparticles"
        init={particlesInit}
        loaded={particlesLoaded}
        options={particlesConfig}
        className="absolute inset-0 z-0"
      />
      
      {/* Header */}
      <motion.header 
        className="relative z-10 text-center py-8"
        variants={itemVariants}
      >
        <motion.div 
          className="inline-flex items-center gap-3 mb-4"
          whileHover={{ scale: 1.05 }}
        >
          <Brain className="w-8 h-8 text-blue-400 animate-pulse" />
          <h1 className="text-4xl font-bold gradient-text">Neural Knowledge Hub</h1>
          <Sparkles className="w-8 h-8 text-purple-400 animate-pulse" />
        </motion.div>
        <motion.p 
          className="text-xl text-gray-300 max-w-2xl mx-auto"
          variants={itemVariants}
        >
          Transform your documents into searchable knowledge with AI-powered processing
        </motion.p>
      </motion.header>

      {/* Main Content */}
      <motion.div 
        className="relative z-10 flex items-center justify-center px-4 pb-8"
        variants={containerVariants}
      >
        <div className="w-full max-w-7xl">
          <motion.div 
            className="glass-dark rounded-3xl shadow-2xl overflow-hidden border border-white/20 backdrop-blur-xl"
            variants={itemVariants}
            whileHover={{ boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}
          >
            <div className="flex flex-col lg:flex-row h-[80vh]">
              <UploadSection
                fileToUpload={fileToUpload}
                setFileToUpload={setFileToUpload}
                uploadStatus={uploadStatus}
                errorMessage={errorMessage}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                onUpload={handleUpload}
                onValidationError={handleValidationError}
                onStatusChange={handleStatusChange}
              />
              
              <ChatSection
                chat={chat}
                input={input}
                setInput={setInput}
                isThinking={isThinking}
                isTyping={isTyping}
                onChatSubmit={handleChatSubmit}
              />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

