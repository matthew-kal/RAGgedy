export interface Chunk {
    id: string;
    projectId: string[];
    documentId: string;
    content: string;
    metadata: {
      source_file: string;
      page_number: number;
      chunk_index: number;
      user_description?: string;
      keywords?: string[];
    };
  }