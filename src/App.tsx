import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard';
import GpuManagement from './pages/GpuManagement';
import Jobs from './pages/Jobs';
import PersonDossiers from './pages/PersonDossiers';
import ModelManagement from './pages/ModelManagement';
import StorageManagement from './pages/StorageManagement';
import MLDashboard from './pages/MLDashboard';

function App() {
  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="gpu" element={<GpuManagement />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="persons" element={<PersonDossiers />} />
            <Route path="models" element={<ModelManagement />} />
            <Route path="storage" element={<StorageManagement />} />
            <Route path="ml" element={<MLDashboard />} />
          </Route>
        </Routes>
      </Router>
      <Toaster 
        position="top-right" 
        richColors 
        closeButton 
        duration={4000}
      />
    </>
  );
}

export default App;
