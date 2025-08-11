// apps/server-backend/src/db/migrations.ts
import { db } from './index';

export async function setupDatabase() {
    const schema = db.schema;

    console.log('Setting up database tables if they do not exist...');

    await schema.createTable('projects')
        .ifNotExists()
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('createdAt', 'text', (col) => col.notNull())
        .execute();

    await schema.createTable('documents')
        .ifNotExists()
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('projectId', 'text', (col) => col.notNull())
        .addColumn('fileName', 'text', (col) => col.notNull())
        .addColumn('filePath', 'text', (col) => col.notNull())
        .addColumn('fileType', 'text', (col) => col.notNull())
        .addColumn('status', 'text', (col) => col.notNull())
        .addColumn('createdAt', 'text', (col) => col.notNull())
        .execute();

    await schema.createTable('chunks')
        .ifNotExists()
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('documentId', 'text', (col) => col.notNull())
        .addColumn('content', 'text', (col) => col.notNull())
        .addColumn('vectorId', 'text')
        .addColumn('metadata', 'text', (col) => col.notNull())
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