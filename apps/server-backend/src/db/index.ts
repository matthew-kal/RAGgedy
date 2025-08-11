import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import { Database as AppDatabase } from './schema'; // Import the master interface
import path from 'path';

// Define the path where the database file will be stored.
// Placing it in the project root is fine for development.
const dbPath = path.resolve(process.cwd(), 'local-rag-app.db');

const dialect = new SqliteDialect({
    database: new Database(dbPath),
});

// Export a ready-to-use Kysely instance typed with our schema.
export const db = new Kysely<AppDatabase>({ dialect });