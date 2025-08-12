# Project: RAGgedy - Your Local AI Knowledge Base

A private, secure, and powerful desktop application that turns your collection of documents into an interactive, conversational knowledge base. Chat with your files locally, without your data ever leaving your machine.

---

## Key Features

- **Local-First & Private:** All document processing and AI chat happens 100% on your machine. No cloud uploads, no data sharing.
- **Project-Based Organization:** Group your documents into isolated projects to keep your work, personal files, and research separate.
- **Intelligent Document Processing:** Upload various file types (PDFs, DOCX, TXT, images) and the app will automatically extract text, understand the layout, and prepare it for conversation using advanced OCR and parsing.
- **Conversational Search (RAG):** Ask questions in plain English and get answers synthesized from your documents, complete with source references.
- **Granular Context Control:** Focus your conversation on your entire library, a specific project, or even a single document.

---

## Technical Architecture

This project is a modern desktop application built on a polyglot, microservice-inspired architecture.

- **Frontend:** An **Electron** application with a **React** UI, providing a responsive and native cross-platform experience.
- **Backend:** A **Node.js** server using **Fastify** to manage projects, documents, python-subprocesses, and API requests.

--- 