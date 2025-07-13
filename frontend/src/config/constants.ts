import { FileText } from "lucide-react";
import { FileType } from "../types";

export const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/html',
  'text/plain',
  'message/rfc822'
];

export const ACCEPTED_EXTENSIONS: FileType[] = [
  { ext: 'PDF', icon: FileText, color: 'text-red-400' },
  { ext: 'DOCX', icon: FileText, color: 'text-blue-400' },
  { ext: 'PPTX', icon: FileText, color: 'text-orange-400' },
  { ext: 'HTML', icon: FileText, color: 'text-green-400' },
  { ext: 'TXT', icon: FileText, color: 'text-gray-400' },
  { ext: 'EML', icon: FileText, color: 'text-purple-400' }
];

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_STATUS_ATTEMPTS = 60;
export const STATUS_POLL_INTERVAL = 5000; // 5 seconds 