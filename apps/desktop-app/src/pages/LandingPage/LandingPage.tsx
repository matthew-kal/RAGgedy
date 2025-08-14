import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, FileText, Sparkles } from 'lucide-react'
import './LandingPage.css'
import type { Project } from 'shared-types'
import { apiFetch } from '../../lib/api'


export const SkeletonCard: React.FC = () => {
  return (
    <div className="project-card skeleton-card glass-effect-subtle">
      <div className="project-header">
        <div className="skeleton skeleton-title"></div>
        <div className="skeleton skeleton-badge"></div>
      </div>
      <div className="skeleton skeleton-text"></div>
      <div className="skeleton skeleton-text short"></div>
      <div className="project-footer">
        <div className="skeleton skeleton-footer"></div>
      </div>
    </div>
  )
}

const EmptyState: React.FC = () => {
  return (
    <motion.div
      className="empty-state"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="empty-state-content glass-effect-subtle">
        <motion.div
          className="empty-state-icon"
          initial={{ scale: 0.8, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            duration: 1.2,
            ease: [0.34, 1.56, 0.64, 1],
            delay: 0.3
          }}
        >
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <FileText size={64} strokeWidth={1.5} />
          </motion.div>
          <motion.div
            className="sparkle-1"
            animate={{ 
              scale: [0, 1, 0],
              rotate: [0, 180, 360],
              opacity: [0, 1, 0]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              delay: 0.5,
              ease: "easeInOut"
            }}
          >
            <Sparkles size={16} />
          </motion.div>
          <motion.div
            className="sparkle-2"
            animate={{ 
              scale: [0, 1, 0],
              rotate: [360, 180, 0],
              opacity: [0, 1, 0]
            }}
            transition={{ 
              duration: 2.5,
              repeat: Infinity,
              delay: 1,
              ease: "easeInOut"
            }}
          >
            <Sparkles size={12} />
          </motion.div>
        </motion.div>
        
        <motion.div
          className="empty-state-text"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <h3 className="empty-state-title">Your creative workspace awaits</h3>
          <p className="empty-state-description">
            Begin your journey by creating your first project. 
            <br />
            <em>Welcome to the new age of productivity.</em>
          </p>
        </motion.div>

        
      </div>
    </motion.div>
  )
}

interface LandingPageProps {
  onProjectSelect: (project: Project) => void
}

const LandingPage: React.FC<LandingPageProps> = ({ onProjectSelect }) => {
  const [projects, setProjects] = useState<Project[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await apiFetch('projects')
        console.log('Projects fetched from backend:', data)
        setProjects(data)
      } catch (error) {
        console.log(error)
        setProjects([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchProjects()
  }, [])

  const handleNewProjectClick = () => {
    setIsModalOpen(true)
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault() 
    if (!newProjectName.trim()) return 

    const newProject: Project = {
      id: null,
      name: newProjectName.trim(),
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      description: newProjectDescription.trim(),
      documentCount: 0,
    }
    console.log(newProject)

    try {
      // Use the project data returned from backend (which includes the generated ID)
      const createdProject: Project = await apiFetch('projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      })
      setProjects(prevProjects => [createdProject, ...prevProjects])
      
      // Reset form and close modal
      setNewProjectName('')
      setNewProjectDescription('')
      setIsModalOpen(false)
    } catch (error) {
      console.error('Error creating new project:', error)
    }
  }

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <motion.div
      className="landing-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Top Navigation Bar */}
      <header className="navbar">
        <div className="navbar-left">
          <h1 className="app-title">raggedy</h1>
        </div>
        <div className="navbar-right">
          <button className="new-project-btn glass-effect" onClick={handleNewProjectClick}>
            <Plus size={20} />
            New Project
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Search Bar */}
        <div className="search-section">
          <div className="search-container">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {/* Projects Section */}
        <div className="projects-section">
          <motion.h2 
            className="section-title"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            Your Projects
          </motion.h2>
          {isLoading ? (
            <motion.div 
              className="projects-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <motion.div
                  key={`skeleton-${index}`}
                  initial={{ opacity: 0, y: 50, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ 
                    duration: 0.1,
                    delay: index * 0.05,
                    ease: [0.25, 0.46, 0.45, 0.94]
                  }}
                >
                  <SkeletonCard />
                </motion.div>
              ))}
            </motion.div>
          ) : filteredProjects.length === 0 && projects.length === 0 ? (
            <EmptyState />
          ) : (
            <motion.div 
              key={searchTerm} // Re-animate when search changes
              className="projects-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              {filteredProjects.length === 0 ? (
                <motion.div
                  className="no-results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="no-results-text">
                    No projects match "{searchTerm}". Try a different search term.
                  </p>
                </motion.div>
              ) : (
                filteredProjects.map((project, index) => (
                  <motion.div
                    key={project.id}
                    className="project-card glass-effect glass-effect-subtle"
                    initial={{ opacity: 0, y: 50, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ 
                      duration: 0.1,
                      delay: index * 0.05,
                      ease: [0.25, 0.46, 0.45, 0.94]
                    }}
                    whileHover={{ y: -4, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onProjectSelect(project)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="project-header">
                      <h3 className="project-name">{project.name}</h3>
                      <span className="document-count">{project.documentCount} docs</span>
                    </div>
                    <p className="project-description">{project.description}</p>
                    <div className="project-footer">
                      <span className="last-modified">Created: {project.createdAt}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}
        </div>
      </main>

      {/* Add the Modal JSX here */}
      {isModalOpen && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="modal-content glass-effect"
            initial={{ scale: 0.9, opacity: 0, y: -50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -50 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <form onSubmit={handleCreateProject}>
              <div className="modal-header">
                Create a New Project
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="projectName">Project Name</label>
                  <input
                    id="projectName"
                    type="text"
                    className="modal-input"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g., 'Legal Documents Q3'"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="projectDescription">Description (optional)</label>
                  <textarea
                    id="projectDescription"
                    className="modal-input"
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="Brief description of this project..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="modal-button cancel"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="modal-button submit">
                  Create Project
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  )
}

export default LandingPage
