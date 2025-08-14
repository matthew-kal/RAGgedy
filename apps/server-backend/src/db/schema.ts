import { ColumnType } from 'kysely';

export interface ProjectsTable {
    id: string; 
    name: string;
    description: string;
    lastAccessed: ColumnType<Date, string, string>;
    documentCount: number; 
    createdAt: ColumnType<Date, string, string>;
}

export interface DocumentsTable {
    id: string;
    fileName: string;
    filePath: string;
    fileType: 'pdf' | 'docx' | 'csv' | 'txt' | 'md' | 'html' | 'png' | 'jpeg';
    status: 'queued' | 'parsing' | 'chunking' | 'embedding' | 'indexed' | 'error';
    createdAt: ColumnType<Date, string, string>;
    user_description: string | null;
    keywords: string | null;
}

export interface ProjectDocumentsTable {
    projectId: string; 
    documentId: string; 
}

export interface JobsTable {
    id: string;
    jobType: 'ingest' | 're-embed';
    relatedId: string;

    status: 'queued' | 'processing' | 'done' | 'failed';
    createdAt: ColumnType<Date, string, string>;
}

export interface Database {
    projects: ProjectsTable;
    documents: DocumentsTable;
    project_documents: ProjectDocumentsTable; 
    jobs: JobsTable;
}