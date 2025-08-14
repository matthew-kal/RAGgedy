export type DocumentStatus = 'queued' | 'parsing' | 'chunking' | 'embedding' | 'indexed' | 'error';

export interface Document {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'csv' | 'txt' | 'md' | 'html' | 'png' | 'jpeg';
  status: DocumentStatus;
  createdAt: string;
  userDescription: string | null;
  keywords: string[];
}
