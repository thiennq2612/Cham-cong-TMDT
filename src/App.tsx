import { useState, useEffect } from 'react';
import { getCollaborators, getTimeLogs, initDefaultCollaborators } from './services/db';
import type { Collaborator, TimeLog } from './services/db';
import Timekeeper from './components/Timekeeper';
import Dashboard from './components/Dashboard';
import { PenTool, LayoutDashboard } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'timekeeper' | 'dashboard'>('timekeeper');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize and load database
  const loadData = async () => {
    try {
      await initDefaultCollaborators();
      const collabsList = await getCollaborators();
      const logsList = await getTimeLogs();
      setCollaborators(collabsList);
      setLogs(logsList);
    } catch (err) {
      console.error('Failed to load database records', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update layout constraints depending on the tab for premium user experience
  useEffect(() => {
    const rootEl = document.getElementById('root');
    if (rootEl) {
      if (activeTab === 'dashboard') {
        rootEl.classList.add('expanded-view');
      } else {
        rootEl.classList.remove('expanded-view');
      }
    }
  }, [activeTab]);

  const handleCollaboratorAdded = async () => {
    const list = await getCollaborators();
    setCollaborators(list);
  };

  const handleLogAdded = async () => {
    const list = await getTimeLogs();
    setLogs(list);
  };

  const handleLogDeleted = async () => {
    const list = await getTimeLogs();
    setLogs(list);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'var(--font-heading)',
        fontSize: '1.2rem',
        color: 'var(--text-secondary)'
      }}>
        Đang khởi động hệ thống...
      </div>
    );
  }

  return (
    <>
      <header>
        <h1>FAHASA TMĐT</h1>
        <div className="subtitle">Hệ Thống Chấm Công Cộng Tác Viên</div>
      </header>

      {/* Tabs */}
      <div className="tabs-navigation">
        <button
          className={`tab-btn ${activeTab === 'timekeeper' ? 'active' : ''}`}
          onClick={() => setActiveTab('timekeeper')}
        >
          <PenTool size={16} />
          Chấm Công (CTV)
        </button>
        <button
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={16} />
          Quản Lý (Manager)
        </button>
      </div>

      {/* Views */}
      <main>
        {activeTab === 'timekeeper' ? (
          <Timekeeper
            collaborators={collaborators}
            onCollaboratorAdded={handleCollaboratorAdded}
            onLogAdded={handleLogAdded}
          />
        ) : (
          <Dashboard
            logs={logs}
            onLogDeleted={handleLogDeleted}
            collaborators={collaborators}
            onCollaboratorDeleted={handleCollaboratorAdded}
          />
        )}
      </main>
    </>
  );
}
