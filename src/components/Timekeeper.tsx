import React, { useState, useEffect, useRef } from 'react';
import { addCollaborator, addTimeLog, updateTimeLog } from '../services/db';
import type { Collaborator } from '../services/db';
import { Play, Square, PenTool, Trash2, CheckCircle2, UserPlus, X } from 'lucide-react';

interface TimekeeperProps {
  collaborators: Collaborator[];
  onCollaboratorAdded: () => void;
  onLogAdded: () => void;
}

interface ActiveSession {
  collaboratorName: string;
  checkInTime: number;
  docId?: string;
}

export default function Timekeeper({
  collaborators,
  onCollaboratorAdded,
  onLogAdded
}: TimekeeperProps) {
  // Select collaborators state (supports multi-select)
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  
  // Modal for new CTV
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCTVName, setNewCTVName] = useState('');
  
  // Searchable dropdown states
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const selectRef = useRef<HTMLDivElement | null>(null);

  // Hourly rate state for new CTV modal
  const [newCTVRate, setNewCTVRate] = useState<number>(42000);
  
  // Check-in / Check-out times
  const [checkInTime, setCheckInTime] = useState<number | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<number | null>(null);
  
  // Canvas drawing state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const toggleSelectName = (name: string) => {
    setSelectedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
    setSearchQuery(''); // clear typed search query on selection toggle
  };

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter collaborator list
  const filteredCollaborators = collaborators.filter((collab) =>
    collab.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Load active session from localStorage when collaborators list changes
  useEffect(() => {
    if (selectedNames.length > 0) {
      // Check the first selected name's active session as representative
      const savedSession = localStorage.getItem(`active_session_${selectedNames[0]}`);
      if (savedSession) {
        const parsed: ActiveSession = JSON.parse(savedSession);
        setCheckInTime(parsed.checkInTime);
        setCheckOutTime(null);
        clearSignature();
      } else {
        setCheckInTime(null);
        setCheckOutTime(null);
        clearSignature();
      }
    } else {
      setCheckInTime(null);
      setCheckOutTime(null);
      clearSignature();
    }
  }, [selectedNames]);

  // Initial setup of signature canvas resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      // Keep canvas drawing safe. We only resize on mount or window resize.
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * (window.devicePixelRatio || 1);
      canvas.height = rect.height * (window.devicePixelRatio || 1);
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
        ctx.strokeStyle = '#f8fafc'; // light color on dark canvas
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    };

    resizeCanvas();

    window.addEventListener('resize', resizeCanvas);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Lock body scroll on touch move on canvas wrapper
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const preventDefault = (e: TouchEvent) => {
        e.preventDefault();
      };
      
      // touch-action: none is defined in CSS, but event listener is extra safety
      canvas.addEventListener('touchmove', preventDefault, { passive: false });
      return () => {
        canvas.removeEventListener('touchmove', preventDefault);
      };
    }
  }, [canvasRef.current]);

  // Handle new CTV creation
  const handleAddNewCTV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCTVName.trim()) return;

    try {
      await addCollaborator(newCTVName.trim(), Number(newCTVRate));
      onCollaboratorAdded();
      setSelectedNames((prev) => [...prev, newCTVName.trim()]);
      setNewCTVName('');
      setNewCTVRate(42000);
      setIsModalOpen(false);
    } catch (err) {
      alert('Không thể thêm CTV mới. Vui lòng thử lại!');
    }
  };

  // Check-in Action
  const handleCheckIn = async () => {
    if (selectedNames.length === 0) return;
    const now = Date.now();
    const today = new Date(now).toISOString().split('T')[0];

    try {
      for (const name of selectedNames) {
        const selectedCollab = collaborators.find(c => c.name === name);
        const resolvedRate = selectedCollab?.hourlyRate ?? 42000;

        // Create log record in Firestore immediately with empty checkout and signature
        const logId = await addTimeLog({
          name,
          date: today,
          checkInTime: now,
          checkOutTime: 0,
          signature: '',
          hourlyRate: resolvedRate
        });

        const session: ActiveSession = {
          collaboratorName: name,
          checkInTime: now,
          docId: logId
        };
        localStorage.setItem(`active_session_${name}`, JSON.stringify(session));
      }
      
      setCheckInTime(now);
      onLogAdded();
    } catch (err) {
      alert('Không thể bắt đầu vào ca. Vui lòng thử lại!');
    }
  };

  // Check-out Action
  const handleCheckOut = () => {
    const now = Date.now();
    setCheckOutTime(now);
  };

  // Canvas Drawing Core Logic
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setHasSignature(false);
  };

  // Submit and save to database
  const handleSubmit = async () => {
    if (selectedNames.length === 0 || !checkInTime || !checkOutTime) {
      alert('Vui lòng hoàn thành check-in và check-out đầy đủ!');
      return;
    }

    const isSingle = selectedNames.length === 1;
    if (isSingle && !hasSignature) {
      alert('Vui lòng ký tên xác nhận!');
      return;
    }

    const today = new Date(checkInTime).toISOString().split('T')[0];
    const stampSVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="50" viewBox="0 0 150 50"><rect width="100%" height="100%" fill="%23f59e0b" rx="5"/><text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="bold" fill="white">QUẢN LÝ BỔ SUNG</text></svg>`;
    const signatureData = isSingle && canvasRef.current ? canvasRef.current.toDataURL('image/png') : stampSVG;

    try {
      for (const name of selectedNames) {
        const savedSession = localStorage.getItem(`active_session_${name}`);
        if (savedSession) {
          const parsed: ActiveSession = JSON.parse(savedSession);
          if (parsed.docId) {
            // Update the existing document with checkOutTime and signature
            await updateTimeLog(parsed.docId, {
              checkOutTime,
              signature: signatureData
            });
          } else {
            // Fallback if docId is somehow missing
            const selectedCollab = collaborators.find(c => c.name === name);
            const resolvedRate = selectedCollab?.hourlyRate ?? 42000;
            await addTimeLog({
              name,
              date: today,
              checkInTime,
              checkOutTime,
              signature: signatureData,
              hourlyRate: resolvedRate
            });
          }
          localStorage.removeItem(`active_session_${name}`);
        } else {
          // Fallback if session is somehow missing
          const selectedCollab = collaborators.find(c => c.name === name);
          const resolvedRate = selectedCollab?.hourlyRate ?? 42000;
          await addTimeLog({
            name,
            date: today,
            checkInTime,
            checkOutTime,
            signature: signatureData,
            hourlyRate: resolvedRate
          });
        }
      }

      // Reset component states
      setSelectedNames([]);
      setCheckInTime(null);
      setCheckOutTime(null);
      clearSignature();
      onLogAdded();
      
      alert(isSingle ? 'Gửi báo cáo chấm công thành công!' : 'Đã gửi chấm công hàng loạt thành công!');
    } catch (err) {
      alert('Không thể lưu thông tin chấm công. Vui lòng thử lại!');
    }
  };

  // Formatting helpers
  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <>
      <div className="panel-card">
        <h2 className="panel-title">
          <PenTool size={20} />
          Thông Tin Chấm Công
        </h2>

        {/* CTV Selector */}
        <div className="form-group">
          <label className="form-label">Chọn Cộng Tác Viên (CTV)</label>
          <div className="select-container" ref={selectRef}>
            <div className="searchable-select-container">
              <div className="searchable-select-input-wrapper">
                <input
                  type="text"
                  placeholder={selectedNames.length > 0 ? `Đã chọn ${selectedNames.length} CTV` : "Tìm kiếm hoặc chọn CTV..."}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsOpen(true);
                  }}
                  onFocus={() => setIsOpen(true)}
                />
                <span className={`searchable-select-arrow ${isOpen ? 'open' : ''}`}>▼</span>
              </div>

              {isOpen && (
                <div className="searchable-select-dropdown">
                  {filteredCollaborators.length === 0 ? (
                    <div className="searchable-select-no-results">Không tìm thấy nhân sự</div>
                  ) : (
                    filteredCollaborators.map((collab) => (
                      <div
                        key={collab.id}
                        className={`searchable-select-option ${selectedNames.includes(collab.name) ? 'selected' : ''}`}
                        onClick={() => toggleSelectName(collab.name)}
                        style={{ display: 'flex', justifyContent: 'flex-start', gap: '10px' }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedNames.includes(collab.name)}
                          onChange={() => {}}
                          style={{ pointerEvents: 'none' }}
                        />
                        {collab.name}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            
            <button
              type="button"
              className="btn btn-primary btn-icon"
              onClick={() => setIsModalOpen(true)}
              title="Thêm CTV mới"
            >
              <UserPlus size={20} />
            </button>
          </div>

          {/* Selected tags */}
          {selectedNames.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
              {selectedNames.map((name) => (
                <span key={name} style={{
                  background: 'rgba(139, 92, 246, 0.15)',
                  color: '#c084fc',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                  border: '1px solid rgba(139, 92, 246, 0.2)'
                }}>
                  {name}
                  <button
                    type="button"
                    onClick={() => toggleSelectName(name)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#c084fc',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '0.9rem',
                      lineHeight: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontWeight: 'bold'
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Check-in & Check-out Status Panels */}
        <div className="time-grid">
          <div className="time-card">
            <span className="time-card-title">Giờ Vào Ca</span>
            <span className={`time-card-value ${!checkInTime ? 'empty' : ''}`}>
              {checkInTime ? formatTime(checkInTime) : '--:--'}
            </span>
          </div>
          <div className="time-card">
            <span className="time-card-title">Giờ Ra Ca</span>
            <span className={`time-card-value ${!checkOutTime ? 'empty' : ''}`}>
              {checkOutTime ? formatTime(checkOutTime) : '--:--'}
            </span>
          </div>
        </div>

        {/* Recording Controls */}
        <div className="time-grid" style={{ marginBottom: '24px' }}>
          <button
            type="button"
            className="btn btn-success"
            onClick={handleCheckIn}
            disabled={selectedNames.length === 0 || checkInTime !== null}
          >
            <Play size={18} />
            Vào ca (Check-in)
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCheckOut}
            disabled={selectedNames.length === 0 || checkInTime === null || checkOutTime !== null}
          >
            <Square size={16} />
            Ra ca (Check-out)
          </button>
        </div>

        {/* Signature Capture Canvas or Manager override */}
        {selectedNames.length > 1 ? (
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px dashed rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--border-radius-md)',
            padding: '16px',
            marginBottom: '24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              CHỮ KÝ XÁC NHẬN TỰ ĐỘNG
            </span>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Bạn đang chấm công cho <strong>{selectedNames.length} nhân sự</strong> cùng lúc.
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Hệ thống sẽ tự động ký nhận bằng dấu mộc <strong style={{ color: 'var(--warning)' }}>"QUẢN LÝ BỔ SUNG"</strong> cho tất cả mọi người.
            </p>
          </div>
        ) : (
          <div className="signature-section">
            <label className="form-label">Ký tên xác nhận</label>
            <div className={`canvas-wrapper ${hasSignature ? 'active' : ''}`}>
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              {!hasSignature && (
                <div className="canvas-hint">
                  Dùng ngón tay ký tên trực tiếp tại đây
                </div>
              )}
            </div>
            <div className="canvas-actions">
              <button
                type="button"
                className="btn btn-danger-outline btn-sm"
                onClick={clearSignature}
                disabled={!hasSignature}
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              >
                <Trash2 size={12} />
                Xóa chữ ký (Clear)
              </button>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="bottom-sticky-button">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={
              selectedNames.length === 0 || 
              !checkInTime || 
              !checkOutTime || 
              (selectedNames.length === 1 && !hasSignature)
            }
          >
            <CheckCircle2 size={18} />
            {selectedNames.length > 1 ? 'Hoàn tất & Gửi chấm công nhóm' : 'Hoàn tất & Gửi chấm công'}
          </button>
        </div>
      </div>

      {/* Modal / Popup for Adding CTV */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Thêm CTV Mới</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddNewCTV}>
              <div className="form-group">
                <label className="form-label">Tên Cộng Tác Viên</label>
                <input
                  type="text"
                  placeholder="Nhập họ và tên..."
                  value={newCTVName}
                  onChange={(e) => setNewCTVName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Đơn giá thuê (VNĐ/giờ)</label>
                <input
                  type="number"
                  placeholder="Mặc định: 42000"
                  value={newCTVRate}
                  onChange={(e) => setNewCTVRate(Number(e.target.value))}
                  min="1000"
                  step="1000"
                  required
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary">
                  Thêm CTV
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
