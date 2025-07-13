export interface Source {
  filename: string;
  text: string;
  score: number;
}

export interface ChatMessage {
  sender: "user" | "ai";
  message: string;
  sources?: Source[];
  timestamp: Date;
}

export interface DocumentStatus {
  document_key: string;
  status: "processing" | "complete" | "error";
  timestamp?: string;
  error_message?: string;
  chunks_processed?: number;
}

export interface FileType {
  ext: string;
  icon: any;
  color: string;
} 