import { ColumnType } from 'kysely';

// Represents a user's project (a collection of documents and a chat history)
export interface ProjectsTable {
    id: string; // Primary Key, UUID
    name: string;
    description: string;
    lastAccessed: ColumnType<Date, string, string>;
    documentCount: number;
    createdAt: ColumnType<Date, string, string>;
}

// Represents a single uploaded document
export interface DocumentsTable {
    id: string; // Primary Key, UUID
    projectId: string; // Foreign Key to ProjectsTable
    fileName: string;
    filePath: string; // Absolute path on the user's disk
    fileType: 'pdf' | 'docx' | 'png' | 'csv' | 'txt' | 'md' | 'html' | 'jpeg';
    status: 'pending' | 'processing' | 'indexed' | 'error';
    createdAt: ColumnType<Date, string, string>;
}

// Represents a single chunk of processed text or an image
export interface ChunksTable {
    id: string; // Primary Key, UUID
    documentId: string; // Foreign Key to DocumentsTable
    content: string; // The text content or a generated caption for an image/CSV
    vectorId: string | null; // The ID of the vector in Qdrant, for updates/deletes
    metadata: ColumnType<Record<string, any>, string, string>; // JSON blob for page number, bbox, etc.
}

// A simple table to act as our job queue
export interface JobsTable {
    id: string; // Primary Key, UUID
    jobType: 'ingest' | 're-embed';
    relatedId: string; // The documentId or chunkId this job pertains to
    status: 'queued' | 'processing' | 'done' | 'failed';
    createdAt: ColumnType<Date, string, string>;
}

// This interface pulls all tables together for Kysely
export interface Database {
    projects: ProjectsTable;
    documents: DocumentsTable;
    chunks: ChunksTable;
    jobs: JobsTable;
}