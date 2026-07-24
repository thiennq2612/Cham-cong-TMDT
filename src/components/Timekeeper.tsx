import React, { useState, useEffect, useRef } from 'react';
import { addCollaborator, addTimeLog } from '../services/db';
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
}

export default function Timekeeper({
  collaborators,
  onCollaboratorAdded,
  onLogAdded
}: TimekeeperProps) {
  // Select collaborator state
  const [selectedName, setSelectedName] = useState<string>('');
  
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

  // Sync selectedName with searchQuery
  useEffect(() => {
    setSearchQuery(selectedName || '');
  }, [selectedName]);

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

  // Load active session from localStorage when collaborator changes
  useEffect(() => {
    if (selectedName) {
      const savedSession = localStorage.getItem(`active_session_${selectedName}`);
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
  }, [selectedName]);

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
      setSelectedName(newCTVName.trim());
      setNewCTVName('');
      setNewCTVRate(42000);
      setIsModalOpen(false);
    } catch (err) {
      alert('Không thể thêm CTV mới. Vui lòng thử lại!');
    }
  };

  // Check-in Action
  const handleCheckIn = () => {
    if (!selectedName) return;
    const now = Date.now();
    const session: ActiveSession = {
      collaboratorName: selectedName,
      checkInTime: now
    };
    localStorage.setItem(`active_session_${selectedName}`, JSON.stringify(session));
    setCheckInTime(now);
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
    if (!selectedName || !checkInTime || !checkOutTime || !hasSignature || !canvasRef.current) {
      alert('Vui lòng hoàn thành check-in, check-out và ký tên đầy đủ!');
      return;
    }

    const signatureBase64 = canvasRef.current.toDataURL('image/png');
    const today = new Date(checkInTime).toISOString().split('T')[0];

    const selectedCollab = collaborators.find(c => c.name === selectedName);
    const resolvedRate = selectedCollab?.hourlyRate ?? 42000;

    const logData = {
      name: selectedName,
      date: today,
      checkInTime,
      checkOutTime,
      signature: signatureBase64,
      hourlyRate: resolvedRate
    };

    try {
      await addTimeLog(logData);
      
      // Clear localStorage active session
      localStorage.removeItem(`active_session_${selectedName}`);
      
      // Reset component states
      setCheckInTime(null);
      setCheckOutTime(null);
      clearSignature();
      onLogAdded();
      
      alert('Gửi báo cáo chấm công thành công!');
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
                  placeholder="Tìm kiếm hoặc chọn CTV..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsOpen(true);
                    if (selectedName && e.target.value !== selectedName) {
                      setSelectedName('');
                    }
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
                        className={`searchable-select-option ${selectedName === collab.name ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedName(collab.name);
                          setSearchQuery(collab.name);
                          setIsOpen(false);
                        }}
                      >
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
            disabled={!selectedName || checkInTime !== null}
          >
            <Play size={18} />
            Vào ca (Check-in)
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCheckOut}
            disabled={!selectedName || checkInTime === null || checkOutTime !== null}
          >
            <Square size={16} />
            Ra ca (Check-out)
          </button>
        </div>

        {/* Signature Capture Canvas */}
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

        {/* Submit */}
        <div className="bottom-sticky-button">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!selectedName || !checkInTime || !checkOutTime || !hasSignature}
          >
            <CheckCircle2 size={18} />
            Hoàn tất & Gửi chấm công
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
