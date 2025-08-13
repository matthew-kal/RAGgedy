-- SQLite

SELECT 
    (SELECT COUNT(*) FROM projects) as projectCount,
    (SELECT COUNT(*) FROM documents) as documentCount,
    (SELECT COUNT(*) FROM jobs) as jobCount,
    (SELECT COUNT(*) FROM project_documents) as relationshipCount;