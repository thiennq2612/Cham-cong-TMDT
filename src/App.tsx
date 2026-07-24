import { useState, useEffect } from 'react';
import { 
  initDefaultCollaborators,
  subscribeCollaborators,
  subscribeTimeLogs
} from './services/db';
import type { Collaborator, TimeLog } from './services/db';
import Timekeeper from './components/Timekeeper';
import Dashboard from './components/Dashboard';
import { PenTool, LayoutDashboard } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'timekeeper' | 'dashboard'>('timekeeper');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize and load database in real-time
  useEffect(() => {
    let unsubCollabs: () => void = () => {};
    let unsubLogs: () => void = () => {};

    const setupSubscriptions = async () => {
      try {
        await initDefaultCollaborators();
        
        unsubCollabs = subscribeCollaborators((list) => {
          setCollaborators(list);
        });

        unsubLogs = subscribeTimeLogs((list) => {
          setLogs(list);
        });
      } catch (err) {
        console.error('Failed to initialize real-time subscription', err);
      } finally {
        setLoading(false);
      }
    };

    setupSubscriptions();

    return () => {
      unsubCollabs();
      unsubLogs();
    };
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

  const handleCollaboratorAdded = () => {};
  const handleLogAdded = () => {};
  const handleLogDeleted = () => {};

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
