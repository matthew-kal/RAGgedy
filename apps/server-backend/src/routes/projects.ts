// Example: Create a new project
server.post('/projects', async (request, reply) => {
    const { name } = request.body as { name: string };
    const newProjectId = crypto.randomUUID();

    // Create a directory for the project's files
    const projectPath = `./data/${newProjectId}`;
    await fs.promises.mkdir(projectPath, { recursive: true });

    const newProject = await db
        .insertInto('projects')
        .values({ id: newProjectId, name })
        .returningAll()
        .executeTakeFirstOrThrow();

    return reply.code(201).send(newProject);
});

// Example: Get all projects
server.get('/projects', async (request, reply) => {
    const projects = await db.selectFrom('projects').selectAll().execute();
    return projects;
});