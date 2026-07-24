import { useState } from 'react';
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
    const durationMs = checkOut - checkIn;
    const hours = durationMs / (1000 * 60 * 60);
    // Round to 2 decimal places
    return Math.round(hours * 100) / 100;
  };

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
      const hours = getDurationHours(log.checkInTime, log.checkOutTime);
      const cost = hours * (log.hourlyRate ?? 42000);
      const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('vi-VN');
      
      return {
        'STT': index + 1,
        'Tên CTV': log.name,
        'Ngày làm việc': log.date.split('-').reverse().join('/'),
        'Giờ Vào': formatTime(log.checkInTime),
        'Giờ Ra': formatTime(log.checkOutTime),
        'Tổng Giờ': hours,
        'Đơn giá (đ/h)': log.hourlyRate ?? 42000,
        'Tổng Chi Phí (đ)': cost
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
  const handleDeleteLog = async (id: number) => {
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
  const handleDeleteCollaborator = async (id: number, name: string) => {
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

      {/* Filter Section Card */}
      <div className="panel-card filter-card">
        <h3 className="panel-title" style={{marginBottom: '8px', fontSize: '0.95rem'}}>
          <Search size={16} /> Bộ lọc dữ liệu
        </h3>
        
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Tìm theo tên CTV..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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
                  const hrs = getDurationHours(log.checkInTime, log.checkOutTime);
                  const cost = hrs * (log.hourlyRate ?? 42000);
                  return (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 600 }}>{log.name}</td>
                      <td>{log.date.split('-').reverse().join('/')}</td>
                      <td>{displayTime(log.checkInTime)}</td>
                      <td>{displayTime(log.checkOutTime)}</td>
                      <td>{hrs} giờ</td>
                      <td>
                        <span className="badge-rate">
                          {(log.hourlyRate ?? 42000).toLocaleString('vi-VN')}đ
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--primary-hover)' }}>
                        {cost.toLocaleString('vi-VN')}đ
                      </td>
                      <td>
                        {log.signature ? (
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
