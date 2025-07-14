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

// Define constants at the top
export const ACCEPTED_FILE_TYPES = ['.pdf', '.docx', '.pptx', '.html', '.txt', '.eml'];
export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/html',
  'text/plain',
  'message/rfc822'
];


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
    console.log(process.env.NEXT_PUBLIC_API_URL)
    if (isUploading) {
      const interval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + Math.random() * 15, 90));
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isUploading]);

  // --- HELPER FUNCTIONS ---
  const validateFile = (file: File) => {
    console.log('🔍 [FILE VALIDATION] Starting file validation');
    console.log('📁 [FILE VALIDATION] File details:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: new Date(file.lastModified).toISOString()
    });
    
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    console.log('🔍 [FILE VALIDATION] Extracted extension:', extension);
    console.log('✅ [FILE VALIDATION] Accepted extensions:', ACCEPTED_FILE_TYPES);
    console.log('✅ [FILE VALIDATION] Accepted MIME types:', ACCEPTED_MIME_TYPES);
    
    if (!ACCEPTED_FILE_TYPES.includes(extension) && !ACCEPTED_MIME_TYPES.includes(file.type)) {
      console.error('❌ [FILE VALIDATION] File validation failed');
      console.error('❌ [FILE VALIDATION] Extension not in accepted list:', extension);
      console.error('❌ [FILE VALIDATION] MIME type not in accepted list:', file.type);
      setErrorMessage(`Unsupported file type. Accepted: ${ACCEPTED_FILE_TYPES.join(', ')}`);
      return false;
    }
    
    console.log('✅ [FILE VALIDATION] File validation passed');
    return true;
  };

  const handleValidationError = (error: string) => {
    setErrorMessage(error);
  };

  const handleStatusChange = (status: string) => {
    setUploadStatus(status);
  };

  // --- STATUS POLLING ---
  const pollStatus = async (documentKey: string) => {
    console.log('📊 [STATUS POLLING] Starting status polling for document:', documentKey);
    console.log('📊 [STATUS POLLING] Max attempts:', MAX_STATUS_ATTEMPTS);
    console.log('📊 [STATUS POLLING] Poll interval:', STATUS_POLL_INTERVAL, 'ms');
    
    const maxAttempts = MAX_STATUS_ATTEMPTS;
    let attempts = 0;
    
    const poll = async () => {
      console.log(`📊 [STATUS POLLING] Attempt ${attempts + 1}/${maxAttempts}`);
      
      try {
        const statusUrl = `${process.env.NEXT_PUBLIC_API_URL}/status/${documentKey}`;
        console.log('📊 [STATUS POLLING] Fetching status from:', statusUrl);
        
        const response = await fetch(statusUrl);
        console.log('📊 [STATUS POLLING] Response status:', response.status);
        console.log('📊 [STATUS POLLING] Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          throw new Error(`Failed to fetch status: ${response.status} ${response.statusText}`);
        }
        
        const status: DocumentStatus = await response.json();
        console.log('📊 [STATUS POLLING] Received status:', status);
        
        if (status.status === 'processing') {
          console.log('⏳ [STATUS POLLING] Document still processing...');
          setUploadStatus('🧠 AI is analyzing your document...');
          attempts++;
          
          if (attempts < maxAttempts) {
            console.log(`📊 [STATUS POLLING] Scheduling next poll in ${STATUS_POLL_INTERVAL}ms`);
            setTimeout(poll, STATUS_POLL_INTERVAL);
          } else {
            console.warn('⏱️ [STATUS POLLING] Max attempts reached - timeout');
            setUploadStatus('⏱️ Processing timeout - check back later');
            setIsUploading(false);
            setUploadProgress(0);
            toast.error('Processing timeout');
          }
        } else if (status.status === 'complete') {
          console.log('✅ [STATUS POLLING] Document processing completed!');
          console.log('✅ [STATUS POLLING] Chunks processed:', status.chunks_processed || 0);
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
          console.error('❌ [STATUS POLLING] Document processing failed');
          console.error('❌ [STATUS POLLING] Error message:', status.error_message);
          setUploadStatus(`❌ Processing failed: ${status.error_message || 'Unknown error'}`);
          setIsUploading(false);
          setUploadProgress(0);
          toast.error(`Processing failed: ${status.error_message || 'Unknown error'}`);
        } else {
          console.warn('⚠️ [STATUS POLLING] Unknown status:', status.status);
        }
      } catch (error) {
        console.error('❌ [STATUS POLLING] Error polling status:', error);
        attempts++;
        
        if (attempts < maxAttempts) {
          console.log(`📊 [STATUS POLLING] Retrying in ${STATUS_POLL_INTERVAL}ms due to error`);
          setTimeout(poll, STATUS_POLL_INTERVAL);
        } else {
          console.error('❌ [STATUS POLLING] Max retry attempts reached');
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
    console.log('🚀 [UPLOAD] Starting upload process');
    
    if (!fileToUpload) {
      console.error('❌ [UPLOAD] No file to upload');
      return;
    }
    
    console.log('📁 [UPLOAD] File to upload:', {
      name: fileToUpload.name,
      type: fileToUpload.type,
      size: fileToUpload.size
    });
    
    setIsUploading(true);
    setErrorMessage('');
    setUploadProgress(0);
    console.log('✅ [UPLOAD] Upload state initialized');
    
    const uploadToast = toast.loading('Preparing upload...', {
      icon: '⚡',
    });
    
    try {
      console.log('📡 [UPLOAD] Step 1: Getting presigned URL');
      setUploadStatus('⚡ Preparing upload...');
      setUploadProgress(10);
      
      const presignedUrl = `${process.env.NEXT_PUBLIC_API_URL}/generate-upload-url`;
      const presignedPayload = {
        filename: fileToUpload.name,
        contentType: fileToUpload.type
      };
      
      console.log('📡 [UPLOAD] Presigned URL endpoint:', presignedUrl);
      console.log('📡 [UPLOAD] Presigned URL payload:', presignedPayload);
      
      const presignedResponse = await fetch(presignedUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presignedPayload)
      });
      
      console.log('📡 [UPLOAD] Presigned URL response status:', presignedResponse.status);
      console.log('📡 [UPLOAD] Presigned URL response headers:', Object.fromEntries(presignedResponse.headers.entries()));
      
      if (!presignedResponse.ok) {
        const errorData = await presignedResponse.json();
        console.error('❌ [UPLOAD] Presigned URL request failed:', errorData);
        throw new Error(errorData.error || 'Failed to get upload URL');
      }
      
      const presignedData = await presignedResponse.json();
      console.log('✅ [UPLOAD] Presigned URL received:', presignedData);
      setCurrentDocumentKey(presignedData.document_key);
      console.log('📝 [UPLOAD] Document key set:', presignedData.document_key);
      
      console.log('☁️ [UPLOAD] Step 2: Uploading to S3');
      setUploadStatus('🚀 Uploading to cloud...');
      setUploadProgress(30);
      
      const formData = new FormData();
      console.log('📋 [UPLOAD] Building FormData with presigned fields:');
      Object.entries(presignedData.fields).forEach(([key, value]) => {
        console.log(`📋 [UPLOAD] Adding field: ${key} = ${value}`);
        formData.append(key, value as string);
      });
      formData.append('file', fileToUpload);
      console.log('📋 [UPLOAD] File added to FormData');
      
      console.log('☁️ [UPLOAD] Uploading to S3 URL:', presignedData.url);
      const uploadResponse = await fetch(presignedData.url, {
        method: 'POST',
        body: formData
      });
      
      console.log('☁️ [UPLOAD] S3 upload response status:', uploadResponse.status);
      console.log('☁️ [UPLOAD] S3 upload response headers:', Object.fromEntries(uploadResponse.headers.entries()));
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('❌ [UPLOAD] S3 upload failed:', errorText);
        throw new Error('Failed to upload file');
      }
      
      console.log('✅ [UPLOAD] File uploaded to S3 successfully');
      setUploadProgress(60);
      toast.dismiss(uploadToast);
      toast.success('Upload complete! Processing...', {
        icon: '🧠',
      });
      
      console.log('🔄 [UPLOAD] Step 3: Starting status polling');
      setUploadStatus('🧠 AI is processing your document...');
      pollStatus(presignedData.document_key);
      
    } catch (error: any) {
      console.error('❌ [UPLOAD] Upload process failed:', error);
      console.error('❌ [UPLOAD] Error details:', {
        message: error.message,
        stack: error.stack
      });
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
    console.log('⌨️ [CHAT] Simulating typing for message length:', message.length);
    setIsTyping(true);
    const typingDuration = Math.min(message.length * 30, 3000);
    console.log('⌨️ [CHAT] Typing duration:', typingDuration, 'ms');
    setTimeout(() => {
      console.log('⌨️ [CHAT] Typing simulation complete');
      setIsTyping(false);
      callback();
    }, typingDuration);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    console.log('💬 [CHAT] Chat form submitted');
    e.preventDefault();
    const trimmed = input.trim();
    
    if (!trimmed || isThinking) {
      console.log('💬 [CHAT] Invalid submission - empty input or already thinking');
      return;
    }
    
    console.log('💬 [CHAT] User query:', trimmed);
    
    const userMessage: ChatMessage = {
      sender: "user",
      message: trimmed,
      timestamp: new Date()
    };
    
    console.log('💬 [CHAT] Adding user message to chat');
    setChat(prev => [...prev, userMessage]);
    setInput("");
    setIsThinking(true);
    
    try {
      const queryUrl = `${process.env.NEXT_PUBLIC_API_URL}/query`;
      const queryPayload = { query: trimmed };
      
      console.log('💬 [CHAT] Sending query to API:', queryUrl);
      console.log('💬 [CHAT] Query payload:', queryPayload);
      
      const res = await fetch(queryUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queryPayload),
      });
      
      console.log('💬 [CHAT] Query response status:', res.status);
      console.log('💬 [CHAT] Query response headers:', Object.fromEntries(res.headers.entries()));
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error('❌ [CHAT] Query request failed:', errorData);
        throw new Error(errorData.error || "Query failed");
      }
      
      const data = await res.json();
      console.log('✅ [CHAT] Query response received:', data);
      console.log('✅ [CHAT] AI response length:', data.response?.length || 0);
      console.log('✅ [CHAT] Sources count:', data.sources?.length || 0);
      
      simulateTyping(data.response, () => {
        console.log('💬 [CHAT] Adding AI message to chat');
        const aiMessage: ChatMessage = {
          sender: "ai",
          message: data.response || "(No response)",
          sources: data.sources,
          timestamp: new Date()
        };
        setChat(prev => [...prev, aiMessage]);
      });
      
    } catch (err: any) {
      console.error('❌ [CHAT] Chat submission failed:', err);
      console.error('❌ [CHAT] Error details:', {
        message: err.message,
        stack: err.stack
      });
      const errorMessage: ChatMessage = {
        sender: "ai",
        message: `Error: ${err.message}`,
        timestamp: new Date()
      };
      setChat(prev => [...prev, errorMessage]);
      toast.error(`Query failed: ${err.message}`);
    } finally {
      console.log('💬 [CHAT] Setting thinking state to false');
      setIsThinking(false);
    }
  };

  // --- FILE DROP HANDLER ---
  const handleFileDrop = (file: File | null) => {
    console.log('📂 [FILE DROP] File drop handler called');
    
    if (!file) {
      console.log('📂 [FILE DROP] No file provided, clearing state');
      setFileToUpload(null);
      return;
    }
    
    console.log('📂 [FILE DROP] File dropped:', {
      name: file.name,
      type: file.type,
      size: file.size
    });
    
    if (validateFile(file)) {
      console.log('✅ [FILE DROP] File validation passed, setting file');
      setFileToUpload(file);
      setErrorMessage('');
    } else {
      console.log('❌ [FILE DROP] File validation failed, clearing file');
      setFileToUpload(null);
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
                setFileToUpload={handleFileDrop}
                uploadStatus={uploadStatus}
                errorMessage={errorMessage}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                onUpload={handleUpload}
                onValidationError={() => {}}
                onStatusChange={() => {}}
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

