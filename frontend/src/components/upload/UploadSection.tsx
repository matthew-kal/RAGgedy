import React, { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { Upload, Zap } from "lucide-react";
import { UploadZone } from "./UploadZone";
import { FileInfo } from "./FileInfo";
import { StatusMessage } from "../ui/StatusMessage";
import { ProgressBar } from "../ui/ProgressBar";
import { Button } from "../ui/Button";
import { itemVariants } from "../../config/animations";
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from "../../config/constants";

interface UploadSectionProps {
  fileToUpload: File | null;
  setFileToUpload: (file: File | null) => void;
  uploadStatus: string;
  errorMessage: string;
  isUploading: boolean;
  uploadProgress: number;
  onUpload: () => void;
  onValidationError: (error: string) => void;
  onStatusChange: (status: string) => void;
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  fileToUpload,
  setFileToUpload,
  uploadStatus,
  errorMessage,
  isUploading,
  uploadProgress,
  onUpload,
  onValidationError,
  onStatusChange
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const validateFile = (file: File): boolean => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      const error = `File type not supported. Accepted types: PDF, DOCX, PPTX, HTML, TXT, EML`;
      onValidationError(error);
      toast.error(error);
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      const error = 'File size must be less than 100MB';
      onValidationError(error);
      toast.error(error);
      return false;
    }
    return true;
  };

  const handleFileSelect = (file: File) => {
    onValidationError('');
    onStatusChange('');
    
    if (validateFile(file)) {
      setFileToUpload(file);
      onStatusChange(`Selected: ${file.name}`);
      toast.success(`File selected: ${file.name}`);
    } else {
      setFileToUpload(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const getStatusType = () => {
    if (isUploading) return "loading";
    if (uploadStatus.includes('✨')) return "success";
    if (uploadStatus.includes('❌')) return "error";
    return "info";
  };

  return (
    <motion.div 
      className="lg:w-1/2 p-8 border-r border-white/10"
      variants={itemVariants}
    >
      <motion.div 
        className="flex items-center gap-3 mb-6"
        whileHover={{ scale: 1.02 }}
      >
        <Upload className="w-6 h-6 text-green-400" />
        <h2 className="text-2xl font-bold">Upload Document</h2>
      </motion.div>
      
      <UploadZone
        isDragOver={isDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onFileSelect={handleFileSelect}
        className="mb-6"
      />
      
      <Button
        onClick={onUpload}
        disabled={!fileToUpload || isUploading}
        variant="gradient"
        size="lg"
        className="w-full mb-6"
        icon={<Zap className="w-5 h-5" />}
        isLoading={isUploading}
      >
        {isUploading ? "Processing..." : "Upload & Process"}
      </Button>
      
      {isUploading && (
        <ProgressBar progress={uploadProgress} className="mb-6" />
      )}
      
      {uploadStatus && (
        <StatusMessage 
          message={uploadStatus}
          type={getStatusType()}
          className="mb-4"
        />
      )}
      
      {errorMessage && (
        <StatusMessage 
          message={errorMessage}
          type="error"
          className="mb-4"
        />
      )}
      
      <FileInfo file={fileToUpload} />
    </motion.div>
  );
}; 