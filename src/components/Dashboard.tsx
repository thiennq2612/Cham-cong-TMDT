import { useState, useEffect, useRef } from 'react';
import { deleteTimeLog, deleteCollaborator, addTimeLog } from '../services/db';
import type { TimeLog, Collaborator } from '../services/db';
import { Search, Download, Trash2, Calendar, FileSpreadsheet, X, Clock, DollarSign, Users } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DashboardProps {
  logs: TimeLog[];
  onLogDeleted: () => void;
  collaborators: Collaborator[];
  onCollaboratorDeleted: () => void;
}

export default function Dashboard({
  logs,
  onLogDeleted,
  collaborators,
  onCollaboratorDeleted
}: DashboardProps) {
  // Search & filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Searchable filter dropdown states
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const filterSelectRef = useRef<HTMLDivElement | null>(null);
  
  // Collaborators search state
  const [collabSearch, setCollabSearch] = useState('');

  // Manual timekeeping adjustment form states
  const [manualCollabName, setManualCollabName] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [manualCheckInTime, setManualCheckInTime] = useState('08:00');
  const [manualCheckOutTime, setManualCheckOutTime] = useState('17:00');
  
  // Selected signature for zoom modal
  const [zoomedSignature, setZoomedSignature] = useState<string | null>(null);

  // Helper: calculate total hours (decimal format)
  const getDurationHours = (checkIn: number, checkOut: number) => {
    if (!checkOut || checkOut === 0) return 0;
    const durationMs = checkOut - checkIn;
    const hours = durationMs / (1000 * 60 * 60);
    // Round to 2 decimal places
    return Math.round(hours * 100) / 100;
  };

  // Sync filterSearchQuery with searchTerm
  useEffect(() => {
    setFilterSearchQuery(searchTerm || '');
  }, [searchTerm]);

  // Click outside to close filter dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterSelectRef.current && !filterSelectRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter collaborators list for dropdown selection
  const filteredFilterCollabs = collaborators.filter((collab) =>
    collab.name.toLowerCase().includes(filterSearchQuery.toLowerCase())
  );

  // Filter logs based on search name and date range
  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && log.date >= startDate;
    }
    if (endDate) {
      matchesDate = matchesDate && log.date <= endDate;
    }
    
    return matchesSearch && matchesDate;
  });

  // Calculate statistics
  const totalHours = filteredLogs.reduce((acc, log) => acc + getDurationHours(log.checkInTime, log.checkOutTime), 0);
  const totalCost = filteredLogs.reduce((acc, log) => {
    const hrs = getDurationHours(log.checkInTime, log.checkOutTime);
    return acc + (hrs * (log.hourlyRate ?? 42000));
  }, 0);

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredLogs.length === 0) {
      alert('Không có dữ liệu để xuất file Excel!');
      return;
    }

    // Sort logs chronologically by date/checkInTime ascending (oldest first)
    const sortedLogsForExcel = [...filteredLogs].sort((a, b) => a.checkInTime - b.checkInTime);

    const data = sortedLogsForExcel.map((log, index) => {
      const isWorking = !log.checkOutTime || log.checkOutTime === 0;
      const hours = getDurationHours(log.checkInTime, log.checkOutTime);
      const cost = hours * (log.hourlyRate ?? 42000);
      const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('vi-VN');
      
      return {
        'STT': index + 1,
        'Tên CTV': log.name,
        'Ngày làm việc': log.date.split('-').reverse().join('/'),
        'Giờ Vào': formatTime(log.checkInTime),
        'Giờ Ra': isWorking ? 'Đang làm việc' : formatTime(log.checkOutTime),
        'Tổng Giờ': isWorking ? '--' : hours,
        'Đơn giá (đ/h)': log.hourlyRate ?? 42000,
        'Tổng Chi Phí (đ)': isWorking ? '--' : cost
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Set column widths for better readability
    const colsWidth = [
      { wch: 6 },  // STT
      { wch: 22 }, // Tên CTV
      { wch: 15 }, // Ngày làm việc
      { wch: 12 }, // Giờ Vào
      { wch: 12 }, // Giờ Ra
      { wch: 10 }, // Tổng Giờ
      { wch: 14 }, // Đơn giá
      { wch: 18 }  // Tổng Chi Phí
    ];
    worksheet['!cols'] = colsWidth;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lịch sử chấm công');
    
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `BaoCao_ChamCong_CTV_${dateStr}.xlsx`);
  };

  // Delete Log handler
  const handleDeleteLog = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa bản ghi chấm công này?')) {
      try {
        await deleteTimeLog(id);
        onLogDeleted();
      } catch (err) {
        alert('Xóa thất bại. Vui lòng thử lại!');
      }
    }
  };

  // Format currency in VND
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  // Format time display
  const displayTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // Delete Collaborator handler
  const handleDeleteCollaborator = async (id: string, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa nhân sự "${name}" khỏi hệ thống?`)) {
      try {
        await deleteCollaborator(id);
        onCollaboratorDeleted();
      } catch (err) {
        alert('Xóa nhân sự thất bại. Vui lòng thử lại!');
      }
    }
  };

  // Filter collaborator list
  const filteredCollabs = collaborators.filter((collab) =>
    collab.name.toLowerCase().includes(collabSearch.toLowerCase())
  );

  // Manual log saving logic
  const handleSaveManualLog = async () => {
    if (!manualCollabName || !manualDate || !manualCheckInTime || !manualCheckOutTime) {
      alert('Vui lòng điền đầy đủ thông tin!');
      return;
    }

    const checkInDateTime = new Date(`${manualDate}T${manualCheckInTime}`);
    const checkOutDateTime = new Date(`${manualDate}T${manualCheckOutTime}`);

    if (isNaN(checkInDateTime.getTime()) || isNaN(checkOutDateTime.getTime())) {
      alert('Thời gian nhập vào không hợp lệ!');
      return;
    }

    if (checkOutDateTime.getTime() <= checkInDateTime.getTime()) {
      alert('Thời gian ra phải sau thời gian vào!');
      return;
    }

    const selectedCollab = collaborators.find(c => c.name === manualCollabName);
    const resolvedRate = selectedCollab?.hourlyRate ?? 42000;

    // SVG stamp
    const stampSVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="50" viewBox="0 0 150 50"><rect width="100%" height="100%" fill="%23f59e0b" rx="5"/><text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="bold" fill="white">QUẢN LÝ BỔ SUNG</text></svg>`;

    const logData = {
      name: manualCollabName,
      date: manualDate,
      checkInTime: checkInDateTime.getTime(),
      checkOutTime: checkOutDateTime.getTime(),
      signature: stampSVG,
      hourlyRate: resolvedRate
    };

    try {
      await addTimeLog(logData);
      onLogDeleted(); // refresh parent logs state
      
      // reset
      setManualCollabName('');
      setManualDate('');
      setManualCheckInTime('08:00');
      setManualCheckOutTime('17:00');
      
      alert(`Đã thêm bổ sung chấm công cho ${manualCollabName} thành công!`);
    } catch (err) {
      alert('Thêm chấm công bổ sung thất bại!');
    }
  };

  // Compute today's attendance status
  const getTodayAttendance = () => {
    // Today's date in GMT+7 / local timezone YYYY-MM-DD
    const localTodayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    
    // Filter logs of today
    const todayLogs = logs.filter(log => log.date === localTodayStr);
    
    return collaborators.map(collab => {
      // Find if this collaborator has any log today
      const collabLogs = todayLogs.filter(log => log.name === collab.name);
      
      let status: 'not_in' | 'working' | 'finished' = 'not_in';
      let detail = '';
      
      if (collabLogs.length > 0) {
        // Since logs are sorted desc by checkInTime, collabLogs[0] is the latest log of today
        const latestLog = collabLogs[0];
        if (latestLog.checkOutTime === 0 || !latestLog.checkOutTime) {
          status = 'working';
          detail = `Vào ca lúc ${new Date(latestLog.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
          status = 'finished';
          const durationMs = latestLog.checkOutTime - latestLog.checkInTime;
          const hours = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;
          detail = `Đã ra ca (${hours}h)`;
        }
      }
      
      return {
        id: collab.id,
        name: collab.name,
        status,
        detail
      };
    });
  };

  const todayAttendance = getTodayAttendance();

  return (
    <>
      {/* Metrics Section */}
      <div className="metrics-grid">
        <div className="metric-card">
          <Users size={16} className="text-secondary" />
          <span className="metric-value">{collaborators.length}</span>
          <span className="metric-label">Nhân sự</span>
        </div>
        <div className="metric-card">
          <Clock size={16} className="text-secondary" />
          <span className="metric-value">{Math.round(totalHours * 10) / 10}h</span>
          <span className="metric-label">Tổng giờ</span>
        </div>
        <div className="metric-card">
          <DollarSign size={16} className="text-secondary" />
          <span className="metric-value" style={{fontSize: '0.9rem'}}>
            {formatCurrency(totalCost).replace(' ₫', 'đ')}
          </span>
          <span className="metric-label">Tổng chi</span>
        </div>
      </div>

      {/* Today's Attendance Status Card */}
      <div className="panel-card" style={{ marginBottom: '20px' }}>
        <h3 className="panel-title" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} /> Điểm danh hôm nay ({new Date().toLocaleDateString('vi-VN')})
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>
            Tổng số: {collaborators.length} CTV
          </span>
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
          {todayAttendance.map((item) => {
            let badgeBg = 'rgba(239, 68, 68, 0.08)';
            let badgeColor = '#ef4444';
            let statusLabel = 'Chưa vào ca';
            
            if (item.status === 'working') {
              badgeBg = 'rgba(245, 158, 11, 0.12)';
              badgeColor = '#f59e0b';
              statusLabel = item.detail;
            } else if (item.status === 'finished') {
              badgeBg = 'rgba(16, 185, 129, 0.12)';
              badgeColor = '#10b981';
              statusLabel = item.detail;
            }
            
            return (
              <div key={item.id} style={{
                background: 'var(--bg-dark-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '8px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.name}>
                  {item.name}
                </span>
                <span style={{
                  background: badgeBg,
                  color: badgeColor,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  display: 'inline-block',
                  width: 'fit-content'
                }}>
                  {statusLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter Section Card */}
      <div className="panel-card filter-card">
        <h3 className="panel-title" style={{marginBottom: '8px', fontSize: '0.95rem'}}>
          <Search size={16} /> Bộ lọc dữ liệu
        </h3>
        
        <div className="form-group" style={{ marginBottom: 0 }} ref={filterSelectRef}>
          <div className="searchable-select-container">
            <div className="searchable-select-input-wrapper">
              <input
                type="text"
                placeholder="Tìm kiếm hoặc chọn CTV để lọc..."
                value={filterSearchQuery}
                onChange={(e) => {
                  setFilterSearchQuery(e.target.value);
                  setIsFilterDropdownOpen(true);
                  if (searchTerm && e.target.value !== searchTerm) {
                    setSearchTerm('');
                  }
                }}
                onFocus={() => setIsFilterDropdownOpen(true)}
              />
              <span className={`searchable-select-arrow ${isFilterDropdownOpen ? 'open' : ''}`}>▼</span>
            </div>

            {isFilterDropdownOpen && (
              <div className="searchable-select-dropdown" style={{ zIndex: 600 }}>
                <div
                  className={`searchable-select-option ${!searchTerm ? 'selected' : ''}`}
                  onClick={() => {
                    setSearchTerm('');
                    setFilterSearchQuery('');
                    setIsFilterDropdownOpen(false);
                  }}
                >
                  -- Xem tất cả CTV --
                </div>
                {filteredFilterCollabs.length === 0 ? (
                  <div className="searchable-select-no-results">Không tìm thấy nhân sự</div>
                ) : (
                  filteredFilterCollabs.map((collab) => (
                    <div
                      key={collab.id}
                      className={`searchable-select-option ${searchTerm === collab.name ? 'selected' : ''}`}
                      onClick={() => {
                        setSearchTerm(collab.name);
                        setFilterSearchQuery(collab.name);
                        setIsFilterDropdownOpen(false);
                      }}
                    >
                      {collab.name}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="date-filters">
          <div>
            <label className="form-label" style={{fontSize: '0.65rem'}}>Từ ngày</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label" style={{fontSize: '0.65rem'}}>Đến ngày</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Manual timekeeping adjustment card */}
      <div className="panel-card filter-card" style={{ marginTop: '20px' }}>
        <h3 className="panel-title" style={{ marginBottom: '8px', fontSize: '0.95rem' }}>
          <Calendar size={16} /> Chấm công bổ sung (Quản trị)
        </h3>
        
        <div className="form-group">
          <label className="form-label" style={{ fontSize: '0.65rem' }}>Chọn Cộng Tác Viên</label>
          <select
            value={manualCollabName}
            onChange={(e) => setManualCollabName(e.target.value)}
            required
          >
            <option value="">-- Chọn nhân sự --</option>
            {collaborators.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="date-filters">
          <div>
            <label className="form-label" style={{ fontSize: '0.65rem' }}>Ngày làm việc</label>
            <input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: '0.65rem' }}>Giờ vào ca</label>
            <input
              type="time"
              value={manualCheckInTime}
              onChange={(e) => setManualCheckInTime(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="date-filters" style={{ marginTop: '10px' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.65rem' }}>Giờ ra ca</label>
            <input
              type="time"
              value={manualCheckOutTime}
              onChange={(e) => setManualCheckOutTime(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveManualLog}
              style={{ width: '100%', padding: '12px' }}
            >
              Lưu chấm công
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table Area */}
      <div className="panel-card logs-section">
        <div className="logs-header">
          <h3 className="panel-title" style={{margin: 0}}>
            <FileSpreadsheet size={18} />
            Lịch Sử Chấm Công ({filteredLogs.length})
          </h3>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExportExcel}
            style={{ padding: '8px 14px', fontSize: '0.8rem' }}
          >
            <Download size={14} />
            Xuất Excel
          </button>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="empty-state">
            <Calendar size={48} />
            <p>Không tìm thấy lịch sử chấm công phù hợp.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Tên CTV</th>
                  <th>Ngày</th>
                  <th>Giờ Vào</th>
                  <th>Giờ Ra</th>
                  <th>Tổng Giờ</th>
                  <th>Đơn Giá</th>
                  <th>Thành Tiền</th>
                  <th>Chữ Ký</th>
                  <th style={{ textAlign: 'center' }}>Xóa</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const isWorking = !log.checkOutTime || log.checkOutTime === 0;
                  const hrs = getDurationHours(log.checkInTime, log.checkOutTime);
                  const cost = hrs * (log.hourlyRate ?? 42000);
                  return (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 600 }}>{log.name}</td>
                      <td>{log.date.split('-').reverse().join('/')}</td>
                      <td>{displayTime(log.checkInTime)}</td>
                      <td>
                        {isWorking ? (
                          <span style={{ color: 'var(--warning)', fontWeight: 600, fontSize: '0.8rem' }}>
                            Đang làm việc
                          </span>
                        ) : (
                          displayTime(log.checkOutTime)
                        )}
                      </td>
                      <td>
                        {isWorking ? (
                          <span style={{ color: 'var(--text-muted)' }}>--</span>
                        ) : (
                          `${hrs} giờ`
                        )}
                      </td>
                      <td>
                        <span className="badge-rate">
                          {(log.hourlyRate ?? 42000).toLocaleString('vi-VN')}đ
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: isWorking ? 'var(--text-secondary)' : 'var(--primary-hover)' }}>
                        {isWorking ? (
                          <span style={{ color: 'var(--text-muted)' }}>--</span>
                        ) : (
                          `${cost.toLocaleString('vi-VN')}đ`
                        )}
                      </td>
                      <td>
                        {isWorking ? (
                          <span style={{ color: 'var(--text-muted)' }}>--</span>
                        ) : log.signature ? (
                          <img
                            src={log.signature}
                            alt="Chữ ký"
                            className="signature-thumbnail"
                            onClick={() => setZoomedSignature(log.signature)}
                            title="Bấm để xem chữ ký lớn"
                          />
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-danger-outline btn-icon"
                          style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                          onClick={() => log.id && handleDeleteLog(log.id)}
                          title="Xóa dòng"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Personnel Management Section */}
      <div className="panel-card logs-section" style={{ marginTop: '20px' }}>
        <h3 className="panel-title" style={{ margin: 0 }}>
          <Users size={18} />
          Quản Lý Danh Sách CTV ({collaborators.length})
        </h3>
        
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Tìm CTV để xóa hoặc xem đơn giá..."
            value={collabSearch}
            onChange={(e) => setCollabSearch(e.target.value)}
          />
        </div>

        {filteredCollabs.length === 0 ? (
          <div className="empty-state">
            <Users size={32} />
            <p>Không tìm thấy nhân sự phù hợp.</p>
          </div>
        ) : (
          <div className="collab-list">
            {filteredCollabs.map((collab) => (
              <div key={collab.id} className="collab-item">
                <div className="collab-name-info">
                  <span className="collab-name-text">{collab.name}</span>
                  <span className="collab-rate-text">
                    Đơn giá: {(collab.hourlyRate ?? 42000).toLocaleString('vi-VN')} đ/giờ
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-danger-outline btn-icon"
                  style={{ width: '32px', height: '32px', borderRadius: '6px' }}
                  onClick={() => collab.id && handleDeleteCollaborator(collab.id, collab.name)}
                  title="Xóa nhân sự"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Signature zoom modal */}
      {zoomedSignature && (
        <div className="modal-overlay" onClick={() => setZoomedSignature(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Chữ Ký Xác Nhận</h3>
              <button className="modal-close" onClick={() => setZoomedSignature(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="signature-zoom-content">
              <img
                src={zoomedSignature}
                alt="Chữ ký mở rộng"
                className="signature-large-img"
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setZoomedSignature(null)}
                style={{ width: '100%' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
