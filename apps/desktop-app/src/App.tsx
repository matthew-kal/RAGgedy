import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage/LandingPage'
import ChatPage from './pages/ChatPage/ChatPage'
import type { Project } from 'shared-types'
import { initializeApi } from './lib/api'
import './App.css'

function App() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  useEffect(() => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.onSetServerPort((port: number) => {
        initializeApi(port);
      });
    }
  }, []);

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project)
  }

  const handleBackToLanding = () => {
    setSelectedProject(null)
  }

  return (
    <div className="App">
      <Router>
        <Routes>
          <Route 
            path="/" 
            element={
              selectedProject ? (
                <Navigate to="/chat" replace />
              ) : (
                <LandingPage onProjectSelect={handleProjectSelect} />
              )
            } 
          />
          <Route 
            path="/chat" 
            element={
              selectedProject ? (
                <ChatPage project={selectedProject} onBack={handleBackToLanding} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
        </Routes>
      </Router>
    </div>
  )
}

export default App
