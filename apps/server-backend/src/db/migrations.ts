// apps/server-backend/src/db/migrations.ts
import { db } from './index.js';

export async function setupDatabase() {
    const schema = db.schema;

    console.log('Setting up database tables if they do not exist...');

    await schema.createTable('projects')
        .ifNotExists()
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('description', 'text', (col) => col.notNull().defaultTo(''))
        .addColumn('lastAccessed', 'text', (col) => col.notNull())
        .addColumn('documentCount', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('createdAt', 'text', (col) => col.notNull())
        .execute();

    await schema.createTable('documents')
        .ifNotExists()
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('fileName', 'text', (col) => col.notNull())
        .addColumn('filePath', 'text', (col) => col.notNull())
        .addColumn('fileType', 'text', (col) => col.notNull())
        .addColumn('status', 'text', (col) => col.notNull().defaultTo('queued'))
        .addColumn('createdAt', 'text', (col) => col.notNull())
        .addColumn('user_description', 'text')
        .addColumn('keywords', 'text') // Storing array as a JSON string
        .execute();

    await schema.createTable('project_documents')
        .ifNotExists()
        .addColumn('projectId', 'text', (col) => col.notNull().references('projects.id'))
        .addColumn('documentId', 'text', (col) => col.notNull().references('documents.id'))
        .addPrimaryKeyConstraint('project_documents_pk', ['projectId', 'documentId'])
        .execute();

    await schema.createTable('jobs')
        .ifNotExists()
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('jobType', 'text', (col) => col.notNull())
        .addColumn('relatedId', 'text', (col) => col.notNull())
        .addColumn('status', 'text', (col) => col.notNull())
        .addColumn('createdAt', 'text', (col) => col.notNull())
        .execute();

    console.log('Database setup complete.');
}