import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar, Plus, Trash2, Eye, EyeOff,
  ChevronLeft, ChevronRight, Layout,
  AlertCircle, Pencil, Check, X, Lock, LogOut, Loader
} from 'lucide-react';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzoHeSt4DxT1m1Oqwiromcldeso49DHDJCtH_JVzVMuKJ2b5Q1GEMig4R_vmvVL-nUMaQ/exec';
const DEFAULT_SLOTS = ['로고 배너', '레이어', '헤더 배너', '강조형 no.1 (#1)', '강조형 no.2 (#2)', '강조형 no.1 (#3)', '강조형 no.2', '강조형 no.3', '띠 배너 (#1)', '띠 배너 (#2)', '플로팅 배너 (#1)', '플로팅 배너 (#2)', '플로팅 배너 (#3)'];
const PASSWORD = '1004'; // ← 비밀번호 여기서 변경

const normalizeDateTime = (str) => {
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str)) return str;
  if (str.length >= 16) return str.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return `${str}T00:00`;
  return str;
};
const toDateOnly = (str) => str ? str.slice(0, 10) : '';

/* ─────────────────────────────────────────
   로그인 화면
───────────────────────────────────────── */
const LoginPage = ({ onLogin }) => {
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = () => {
    if (pw === PASSWORD) {
      onLogin();
    } else {
      setError(true);
      setShake(true);
      setPw('');
      setTimeout(() => setShake(false), 500);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className={`bg-white rounded-3xl shadow-xl border border-slate-100 px-10 py-12 w-full max-w-sm transition-all ${shake ? 'animate-bounce' : ''}`}
        style={shake ? { animation: 'shake 0.4s ease' } : {}}>
        <style>{`
          @keyframes shake {
            0%,100%{transform:translateX(0)}
            20%{transform:translateX(-8px)}
            40%{transform:translateX(8px)}
            60%{transform:translateX(-6px)}
            80%{transform:translateX(6px)}
          }
        `}</style>
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🍦</div>
          <h1 className="text-xl font-bold text-slate-800">배너 관리</h1>
          <p className="text-xs text-slate-400 mt-1">i-Scream Banner Management</p>
        </div>
        <div className="space-y-4">
          <div className="relative">
            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              ref={inputRef}
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className={`w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none transition-all
                ${error ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-200' : 'border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100'}`}
            />
          </div>
          {error && <p className="text-xs text-red-400 text-center font-medium">비밀번호가 올바르지 않아요</p>}
          <button onClick={handleSubmit}
            className="w-full bg-blue-500 hover:bg-blue-600 active:scale-95 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-sm">
            입장하기
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   메인 앱
───────────────────────────────────────── */
const MainApp = ({ onLogout }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showOnlyVisible, setShowOnlyVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('전체');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error

  const [allSlots, setAllSlots] = useState(DEFAULT_SLOTS);
  const [banners, setBanners] = useState([]);
  const [visibleSlots, setVisibleSlots] = useState(
    DEFAULT_SLOTS.reduce((acc, s) => ({ ...acc, [s]: true }), {})
  );

  const isFirstLoad = useRef(true);
  const bannersRef = useRef([]);

  const updateBanners = (fn) => {
    setBanners(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      bannersRef.current = next;
      return next;
    });
  };

  // 30초마다 자동저장
  useEffect(() => {
    const interval = setInterval(() => {
      if (isFirstLoad.current || bannersRef.current.length === 0) return;
      setSaveStatus('saving');
      setSaving(true);
      fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'save', data: bannersRef.current }) })
        .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); })
        .catch(() => { setSaveStatus('error'); })
        .finally(() => setSaving(false));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', dept: '' });
  const nameInputRef = useRef(null);
  const deptInputRef = useRef(null);
  const slotRefs = useRef({});

  useEffect(() => {
    fetch(SCRIPT_URL).then(r => r.json()).then(data => {
      if (data && data.length > 0) {
        setBanners(data.map(b => ({ ...b, id: String(b.id), start: normalizeDateTime(b.start), end: normalizeDateTime(b.end) })));
      }
      setLoading(false);
      setTimeout(() => { isFirstLoad.current = false; }, 100);
    }).catch(() => { setLoading(false); setTimeout(() => { isFirstLoad.current = false; }, 100); });
  }, []);

  useEffect(() => { if (editingId) setTimeout(() => nameInputRef.current?.focus(), 0); }, [editingId]);

  const collisionInfo = useMemo(() => {
    const result = {};
    banners.forEach(b1 => {
      const s1 = new Date(b1.start).getTime(), e1 = new Date(b1.end).getTime();
      result[b1.id] = banners.some(b2 => {
        if (b1.id === b2.id || b1.slot !== b2.slot) return false;
        const s2 = new Date(b2.start).getTime(), e2 = new Date(b2.end).getTime();
        return s1 <= e2 && s2 <= e1;
      });
    });
    return result;
  }, [banners]);

  const handleSlotNameChange = (oldName, newName) => {
    if (!newName || oldName === newName) return;
    setAllSlots(prev => prev.map(s => s === oldName ? newName : s));
    updateBanners(prev => prev.map(b => b.slot === oldName ? { ...b, slot: newName } : b));
  };

  const formatDateOnly = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const shiftDateTime = (str, days) => {
    const d = new Date(str); d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const getStatus = (s, e) => {
    const now = new Date();
    if (new Date(e) < now) return '종료';
    if (new Date(s) > now) return '대기';
    return '진행중';
  };

  const dateRange = useMemo(() => {
    const range = [];
    for (let i = -10; i <= 20; i++) {
      const d = new Date(currentDate); d.setDate(currentDate.getDate() + i);
      range.push(new Date(d.setHours(0,0,0,0)));
    }
    return range;
  }, [currentDate]);

  const viewStart = dateRange[0], viewEnd = dateRange[dateRange.length-1];
  const isToday = (date) => { const n = new Date(); return date.getFullYear()===n.getFullYear()&&date.getMonth()===n.getMonth()&&date.getDate()===n.getDate(); };
  const displaySlots = showOnlyVisible ? allSlots.filter(s => visibleSlots[s]) : allSlots;
  const filteredBanners = banners.filter(b => activeTab === '전체' || getStatus(b.start, b.end) === activeTab);
  const totalPages = Math.ceil(filteredBanners.length / PAGE_SIZE);
  const pagedBanners = filteredBanners.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const [dragging, setDragging] = useState(null);
  const [dropTargetSlot, setDropTargetSlot] = useState(null);

  const handleMouseDown = (e, banner, type) => {
    if (editingId) return;
    e.stopPropagation();
    const slotLayouts = {};
    displaySlots.forEach(slot => {
      const el = slotRefs.current[slot];
      if (el) { const r = el.getBoundingClientRect(); slotLayouts[slot] = { top: r.top, bottom: r.bottom }; }
    });
    setDragging({ id: banner.id, type, startX: e.clientX, startY: e.clientY, initialStart: banner.start, initialEnd: banner.end, initialSlot: banner.slot, slotLayouts });
    setDropTargetSlot(banner.slot);
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging) return;
      const days = Math.round((e.clientX - dragging.startX) / 40);
      let newSlot = dragging.initialSlot;
      if (dragging.type === 'move') {
        for (const [s, r] of Object.entries(dragging.slotLayouts)) {
          if (e.clientY >= r.top && e.clientY <= r.bottom) { newSlot = s; break; }
        }
        setDropTargetSlot(newSlot);
      }
      setBanners(prev => prev.map(b => {
        if (b.id !== dragging.id) return b;
        let ns = dragging.initialStart, ne = dragging.initialEnd;
        if (dragging.type === 'move') { ns = shiftDateTime(ns, days); ne = shiftDateTime(ne, days); }
        else if (dragging.type === 'resize-start') { ns = shiftDateTime(ns, days); if (new Date(ns) >= new Date(ne)) ns = shiftDateTime(ne, -1); }
        else if (dragging.type === 'resize-end') { ne = shiftDateTime(ne, days); if (new Date(ne) <= new Date(ns)) ne = shiftDateTime(ns, 1); }
        return { ...b, start: ns, end: ne, slot: newSlot };
      }));
    };
    const onUp = () => {
      setDragging(null); setDropTargetSlot(null);
    };
    if (dragging) { window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); }
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const startEdit = (e, banner) => { e.stopPropagation(); e.preventDefault(); setEditingId(banner.id); setEditForm({ name: banner.name, dept: banner.dept || '' }); };
  const commitEdit = () => {
    if (!editingId) return;
    updateBanners(prev => prev.map(b => b.id === editingId ? { ...b, name: editForm.name, dept: editForm.dept } : b));
    setEditingId(null);
  };
  const cancelEdit = () => setEditingId(null);

  const makeDefaultDatetime = (addDays = 0, endOfDay = false) => {
    const d = new Date(); d.setDate(d.getDate() + addDays);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${endOfDay ? '23:59' : '00:00'}`;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-400 text-sm">불러오는 중...</p>
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col h-screen bg-slate-50 text-slate-700 overflow-hidden font-sans select-none ${dragging ? 'cursor-grabbing' : ''}`}>

      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-100 z-50">
        <div className="flex items-center gap-5">
          <div>
            <h1 className="text-base font-bold text-slate-800 leading-tight">🍦배너 관리</h1>
            <p className="text-[10px] text-slate-400 leading-tight">i-Scream Banner Management</p>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 px-2.5 py-1.5 rounded-full">
            <ChevronLeft size={14} className="cursor-pointer text-slate-400 hover:text-blue-500 transition-colors"
              onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()-1); setCurrentDate(d); }} />
            <span className="flex items-center gap-1 font-semibold text-slate-600 min-w-[72px] justify-center text-xs">
              <Calendar size={12} className="text-blue-400" />
              {currentDate.getFullYear()}. {currentDate.getMonth()+1}
            </span>
            <ChevronRight size={14} className="cursor-pointer text-slate-400 hover:text-blue-500 transition-colors"
              onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()+1); setCurrentDate(d); }} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 자동저장 상태 */}
          <div className="flex items-center gap-1.5 text-xs">
            {saveStatus === 'saving' && <><Loader size={11} className="text-blue-400 animate-spin" /><span className="text-slate-400">저장 중...</span></>}
            {saveStatus === 'saved' && <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /><span className="text-emerald-500 font-medium">저장됨</span></>}
            {saveStatus === 'error' && <><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /><span className="text-red-400 font-medium">저장 실패</span></>}
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer font-medium">
            <input type="checkbox" checked={showOnlyVisible} onChange={(e) => setShowOnlyVisible(e.target.checked)} className="w-3.5 h-3.5 rounded cursor-pointer" />
            활성 구좌만 보기
          </label>

          <button onClick={() => {
            const id = Date.now().toString();
            updateBanners(prev => [...prev, { id, name: '새 배너', slot: allSlots[0], start: makeDefaultDatetime(0), end: makeDefaultDatetime(4, true), dept: '', color: '#DBEAFE', memo: '' }]);
          }} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-sm transition-all active:scale-95">
            <Plus size={13} /> 배너 추가
          </button>

          <button onClick={onLogout} className="flex items-center gap-1 text-slate-300 hover:text-slate-500 transition-colors p-1.5 rounded-lg hover:bg-slate-100" title="로그아웃">
            <LogOut size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-5">

        {/* 간트차트 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto overflow-y-hidden">
            <table className="w-full border-collapse table-fixed min-w-max">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="w-44 sticky left-0 z-40 bg-white border-r border-slate-100 p-3 text-left">
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">구좌 리스트</span>
                  </th>
                  {dateRange.map((date, idx) => {
                    const today = isToday(date), isSun = date.getDay()===0, isSat = date.getDay()===6;
                    return (
                      <th key={idx} className={`w-[40px] border-r border-slate-100 p-1 text-center ${today ? 'bg-blue-50' : ''}`}>
                        <div className={`text-[9px] font-semibold mb-0.5 ${isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-slate-300'}`}>
                          {['일','월','화','수','목','금','토'][date.getDay()]}
                        </div>
                        {today
                          ? <div className="bg-blue-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center mx-auto">{date.getDate()}</div>
                          : <div className={`text-[11px] font-semibold ${isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-slate-400'}`}>{date.getDate()}</div>
                        }
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {displaySlots.map(slot => (
                  <tr key={slot} ref={el => slotRefs.current[slot] = el}
                    className={`h-8 border-b border-slate-50 transition-colors ${visibleSlots[slot] ? '' : 'opacity-25'} ${dropTargetSlot === slot ? 'bg-blue-50/40' : ''}`}>
                    <td className={`sticky left-0 z-30 border-r border-slate-100 px-3 h-8 shadow-[1px_0_0_0_#f1f5f9] transition-colors ${dropTargetSlot === slot ? 'bg-blue-50' : 'bg-white'}`}>
                      <div className="flex items-center justify-between gap-1">
                        <input className={`text-xs font-semibold bg-transparent outline-none focus:bg-slate-50 rounded px-1 w-full transition-all ${visibleSlots[slot] ? 'text-slate-500' : 'text-slate-300 line-through'}`}
                          defaultValue={slot}
                          onBlur={(e) => handleSlotNameChange(slot, e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />
                        <button onClick={() => setVisibleSlots(v => ({ ...v, [slot]: !v[slot] }))}
                          className={`p-1 rounded transition-colors flex-shrink-0 ${visibleSlots[slot] ? 'text-slate-200 hover:text-blue-400' : 'text-blue-400'}`}>
                          {visibleSlots[slot] ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                      </div>
                    </td>
                    {dateRange.map((date, idx) => {
                      const dateStr = formatDateOnly(date);
                      return (
                        <td key={idx} className={`border-r border-slate-50 relative ${isToday(date) ? 'bg-blue-50/30' : ''}`}>
                          {isToday(date) && <div className="absolute inset-y-0 left-1/2 w-px bg-blue-300/40 z-0 pointer-events-none" />}
                          {visibleSlots[slot] && banners
                            .filter(b => {
                              const bDateOnly = toDateOnly(b.start), bEndOnly = toDateOnly(b.end);
                              if (new Date(bDateOnly) < new Date(formatDateOnly(viewStart))) {
                                return b.slot === slot && idx === 0 && bEndOnly >= formatDateOnly(viewStart);
                              }
                              return b.slot === slot && bDateOnly === dateStr;
                            })
                            .map(banner => {
                              const bStartOnly = toDateOnly(banner.start), bEndOnly = toDateOnly(banner.end);
                              const viewStartStr = formatDateOnly(viewStart), viewEndStr = formatDateOnly(viewEnd);
                              const dispStart = bStartOnly < viewStartStr ? viewStartStr : bStartOnly;
                              const dispEnd = bEndOnly > viewEndStr ? viewEndStr : bEndOnly;
                              const duration = Math.round((new Date(dispEnd) - new Date(dispStart)) / 86400000) + 1;
                              const hasCollision = collisionInfo[banner.id];
                              const isDraggingThis = dragging?.id === banner.id;
                              const isEditingThis = editingId === banner.id;

                              return (
                                <div key={banner.id}
                                  onMouseDown={(e) => !isEditingThis && handleMouseDown(e, banner, 'move')}
                                  style={{
                                    width: `calc(${duration * 40}px - 6px)`,
                                    backgroundColor: banner.color || '#DBEAFE',
                                    top: '5px', left: '3px', height: '22px',
                                    zIndex: isDraggingThis ? 1000 : isEditingThis ? 200 : 20,
                                    opacity: isDraggingThis ? 0.85 : 1,
                                    transform: isDraggingThis ? 'scale(1.02) translateY(-1px)' : 'none',
                                    minWidth: isEditingThis ? '230px' : undefined,
                                  }}
                                  className={`absolute rounded-xl flex items-center overflow-hidden transition-all group/bar border border-white/60 shadow-sm
                                    ${isEditingThis ? 'cursor-default ring-2 ring-blue-400 ring-offset-1' : 'cursor-grab active:cursor-grabbing'}
                                    ${hasCollision && !isEditingThis ? 'ring-2 ring-red-400 ring-offset-1' : ''}
                                    ${isDraggingThis ? 'shadow-lg' : !isEditingThis ? 'hover:brightness-95 hover:shadow-md' : ''}`}
                                >
                                  {!isEditingThis && <>
                                    <div className="absolute left-0 top-0 w-2 h-full cursor-ew-resize z-30 rounded-l-xl" onMouseDown={(e) => handleMouseDown(e, banner, 'resize-start')} />
                                    <div className="absolute right-0 top-0 w-2 h-full cursor-ew-resize z-30 rounded-r-xl" onMouseDown={(e) => handleMouseDown(e, banner, 'resize-end')} />
                                  </>}
                                  {!isEditingThis && (
                                    <div className="flex items-center w-full h-full px-2 gap-1.5">
                                      <svg width="7" height="11" viewBox="0 0 7 11" fill="currentColor" className="flex-shrink-0 text-slate-500/50 pointer-events-none">
                                        <circle cx="1.5" cy="1.5" r="1.2"/><circle cx="5.5" cy="1.5" r="1.2"/>
                                        <circle cx="1.5" cy="5.5" r="1.2"/><circle cx="5.5" cy="5.5" r="1.2"/>
                                        <circle cx="1.5" cy="9.5" r="1.2"/><circle cx="5.5" cy="9.5" r="1.2"/>
                                      </svg>
                                      <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden pointer-events-none">
                                        {hasCollision && <AlertCircle size={11} className="text-red-500 animate-pulse flex-shrink-0" />}
                                        {banner.dept && <span className="text-[9px] px-1.5 py-0.5 bg-black/10 rounded-full font-bold text-slate-600 whitespace-nowrap flex-shrink-0">{banner.dept}</span>}
                                        <span className="text-[11px] font-semibold text-slate-700 truncate">{banner.name}</span>
                                      </div>
                                      {/* 메모 점 - 연필 왼쪽에 나란히 */}
                                      {banner.memo && (
                                        <div className="flex-shrink-0 pointer-events-none">
                                          <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-sm" />
                                        </div>
                                      )}
                                      <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => startEdit(e, banner)}
                                        className="flex-shrink-0 opacity-40 group-hover/bar:opacity-100 transition-opacity bg-white/70 hover:bg-white rounded-md p-0.5 shadow-sm border border-black/10 z-40">
                                        <Pencil size={10} className="text-slate-500" />
                                      </button>
                                    </div>
                                  )}
                                  {!isEditingThis && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/bar:block z-50 pointer-events-none">
                                      <div className="bg-slate-800 text-white text-[11px] rounded-xl px-3 py-2 shadow-xl max-w-[240px] leading-relaxed text-center">
                                        <div className="font-bold">{banner.name}</div>
                                        {banner.memo && <div className="text-slate-300 whitespace-pre-wrap mt-0.5">{banner.memo}</div>}
                                      </div>
                                      <div className="w-2 h-2 bg-slate-800 rotate-45 mx-auto -mt-1" />
                                    </div>
                                  )}
                                  {isEditingThis && (
                                    <div className="flex items-center w-full h-full px-1.5 gap-1" onMouseDown={(e) => e.stopPropagation()}>
                                      <input ref={deptInputRef} className="w-16 h-5 text-[10px] font-bold bg-black/10 rounded-lg px-1.5 outline-none focus:ring-1 focus:ring-blue-400 text-slate-700 placeholder:text-slate-400 flex-shrink-0"
                                        placeholder="부서" value={editForm.dept}
                                        onChange={(e) => setEditForm(f => ({ ...f, dept: e.target.value }))}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => { if (e.key==='Enter') commitEdit(); if (e.key==='Escape') cancelEdit(); if (e.key==='Tab') { e.preventDefault(); nameInputRef.current?.focus(); } }} />
                                      <input ref={nameInputRef} className="flex-1 min-w-0 h-5 text-[11px] font-semibold bg-white/80 rounded-lg px-1.5 outline-none focus:ring-1 focus:ring-blue-400 text-slate-700 placeholder:text-slate-400"
                                        placeholder="배너명" value={editForm.name}
                                        onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => { if (e.key==='Enter') commitEdit(); if (e.key==='Escape') cancelEdit(); if (e.key==='Tab') { e.preventDefault(); deptInputRef.current?.focus(); } }} />
                                      <button onClick={(e) => { e.stopPropagation(); commitEdit(); }} className="flex-shrink-0 bg-blue-500 hover:bg-blue-600 text-white rounded-lg p-0.5"><Check size={11} /></button>
                                      <button onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="flex-shrink-0 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg p-0.5"><X size={11} /></button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 하단 리스트 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center flex-wrap gap-3">
            <h2 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
              <Layout size={15} className="text-blue-400" />
              배너 데이터 상세 설정
              <span className="text-blue-400 text-[11px] px-2 py-0.5 bg-blue-50 rounded-full border border-blue-100 font-bold">Total {filteredBanners.length}</span>
            </h2>
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
              {['전체','진행중','대기','종료'].map(tab => (
                <button key={tab} onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${activeTab === tab ? 'bg-white text-blue-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/60 border-b border-slate-100">
                <tr>
                  {['상태','배너 명칭','담당 부서','색상','노출 구좌','노출 기간 (날짜 · 시간)','메모','삭제'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {pagedBanners.map(banner => {
                  const status = getStatus(banner.start, banner.end);
                  const hasCollision = collisionInfo[banner.id];
                  const isBeingEdited = editingId === banner.id;
                  return (
                    <tr key={banner.id} className={`transition-colors ${hasCollision ? 'bg-red-50/40' : ''} ${isBeingEdited ? 'bg-blue-50/30' : 'hover:bg-slate-50/50'}`}>
                      <td className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap
                            ${status==='진행중' ? 'bg-emerald-50 text-emerald-500' : status==='대기' ? 'bg-blue-50 text-blue-500' : 'bg-slate-100 text-slate-400'}`}>
                            {status}
                          </span>
                          {hasCollision && <span className="text-[9px] font-bold text-red-400 flex items-center gap-0.5 whitespace-nowrap"><AlertCircle size={9} /> 일정 중첩</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <input className="bg-transparent border-b border-transparent focus:border-blue-400 outline-none font-semibold text-sm text-slate-700 w-full transition-all py-0.5 min-w-[120px]"
                          value={banner.name}
                          onChange={(e) => updateBanners(prev => prev.map(b => b.id===banner.id ? {...b, name: e.target.value} : b))} />
                      </td>
                      <td className="px-3 py-3">
                        <input className="bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-100 focus:border-blue-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 w-full text-center transition-all outline-none placeholder:text-slate-300"
                          value={banner.dept||''} placeholder="부서"
                          onChange={(e) => updateBanners(prev => prev.map(b => b.id===banner.id ? {...b, dept: e.target.value} : b))} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input type="color" className="w-7 h-7 rounded-lg cursor-pointer border-2 border-white shadow-sm"
                          value={banner.color}
                          onChange={(e) => updateBanners(prev => prev.map(b => b.id===banner.id ? {...b, color: e.target.value} : b))} />
                      </td>
                      <td className="px-3 py-3">
                        <select className="bg-white border border-slate-100 rounded-lg px-2 py-1 text-xs outline-none font-medium cursor-pointer focus:ring-1 focus:ring-blue-400 w-full"
                          value={banner.slot}
                          onChange={(e) => updateBanners(prev => prev.map(b => b.id===banner.id ? {...b, slot: e.target.value} : b))}>
                          {allSlots.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      {/* 노출 기간 - 시간 잘림 수정: flex-nowrap + 충분한 너비 확보 */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 flex-nowrap">
                          <span className="text-[10px] font-bold text-slate-300 flex-shrink-0">시작</span>
                          <input type="date" className="border border-slate-100 rounded-lg px-1.5 py-1 text-xs focus:ring-1 focus:ring-blue-400 outline-none flex-shrink-0"
                            value={toDateOnly(banner.start)}
                            onChange={(e) => { const t=banner.start?.slice(11,16)||'00:00'; updateBanners(prev => prev.map(b => b.id===banner.id ? {...b, start:`${e.target.value}T${t}`} : b)); }} />
                          <input type="time" className="border border-slate-100 rounded-lg px-1.5 py-1 text-xs focus:ring-1 focus:ring-blue-400 outline-none flex-shrink-0 w-[90px]"
                            value={banner.start?.slice(11,16)||'00:00'}
                            onChange={(e) => { const d=toDateOnly(banner.start); updateBanners(prev => prev.map(b => b.id===banner.id ? {...b, start:`${d}T${e.target.value}`} : b)); }} />
                          <span className="text-slate-300 font-bold flex-shrink-0 px-0.5">~</span>
                          <span className="text-[10px] font-bold text-slate-300 flex-shrink-0">종료</span>
                          <input type="date" className="border border-slate-100 rounded-lg px-1.5 py-1 text-xs focus:ring-1 focus:ring-blue-400 outline-none flex-shrink-0"
                            value={toDateOnly(banner.end)}
                            onChange={(e) => { const t=banner.end?.slice(11,16)||'23:59'; updateBanners(prev => prev.map(b => b.id===banner.id ? {...b, end:`${e.target.value}T${t}`} : b)); }} />
                          <input type="time" className="border border-slate-100 rounded-lg px-1.5 py-1 text-xs focus:ring-1 focus:ring-blue-400 outline-none flex-shrink-0 w-[90px]"
                            value={banner.end?.slice(11,16)||'23:59'}
                            onChange={(e) => { const d=toDateOnly(banner.end); updateBanners(prev => prev.map(b => b.id===banner.id ? {...b, end:`${d}T${e.target.value}`} : b)); }} />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <input className="bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-100 focus:border-blue-300 rounded-lg px-2 py-1 text-xs text-slate-600 w-full transition-all outline-none placeholder:text-slate-300 min-w-[100px]"
                          value={banner.memo||''} placeholder="메모 입력..."
                          onChange={(e) => updateBanners(prev => prev.map(b => b.id===banner.id ? {...b, memo: e.target.value} : b))} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => updateBanners(prev => prev.filter(b => b.id !== banner.id))}
                          className="text-slate-200 hover:text-red-400 transition-colors p-1.5 hover:bg-red-50 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredBanners.length)} / 총 {filteredBanners.length}개
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-100 text-slate-400 hover:text-blue-500 hover:border-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setCurrentPage(p)}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${p === currentPage ? 'bg-blue-500 text-white shadow-sm' : 'border border-slate-100 text-slate-400 hover:text-blue-500 hover:border-blue-200'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-100 text-slate-400 hover:text-blue-500 hover:border-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs">›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   루트
───────────────────────────────────────── */
const App = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  if (!loggedIn) return <LoginPage onLogin={() => setLoggedIn(true)} />;
  return <MainApp onLogout={() => setLoggedIn(false)} />;
};

export default App;
