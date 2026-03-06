import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar, Plus, Trash2, Eye, EyeOff,
  ChevronLeft, ChevronRight, Layout,
  AlertCircle, Save, Pencil, Check, X
} from 'lucide-react';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzoHeSt4DxT1m1Oqwiromcldeso49DHDJCtH_JVzVMuKJ2b5Q1GEMig4R_vmvVL-nUMaQ/exec';
const DEFAULT_SLOTS = ['로고 배너', '레이어', '헤더배너', '강조 no.1 (#1)', '강조 no.1 (#2)', '강조 no.1 (#3)', '강조 no.3 (랜덤)'];

const normalizeDateTime = (str) => {
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str)) return str;
  if (str.length >= 16) return str.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return `${str}T00:00`;
  return str;
};

const toDateOnly = (str) => str ? str.slice(0, 10) : '';

const App = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showOnlyVisible, setShowOnlyVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('전체');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const [allSlots, setAllSlots] = useState(DEFAULT_SLOTS);
  const [banners, setBanners] = useState([]);
  const [visibleSlots, setVisibleSlots] = useState(
    DEFAULT_SLOTS.reduce((acc, slot) => ({ ...acc, [slot]: true }), {})
  );

  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (isFirstLoad.current) return;
    setHasUnsaved(true);
  }, [banners]);

  useEffect(() => {
    const fn = (e) => { if (!hasUnsaved) return; e.preventDefault(); e.returnValue = '저장하지 않은 변경사항이 있어요!'; };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, [hasUnsaved]);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', dept: '' });
  const nameInputRef = useRef(null);
  const deptInputRef = useRef(null);
  const slotRefs = useRef({});

  useEffect(() => {
    fetch(SCRIPT_URL).then(res => res.json()).then(data => {
      if (data && data.length > 0) {
        setBanners(data.map(b => ({ ...b, id: String(b.id), start: normalizeDateTime(b.start), end: normalizeDateTime(b.end) })));
      }
      setLoading(false);
      setTimeout(() => { isFirstLoad.current = false; }, 0);
    }).catch(() => { setLoading(false); setTimeout(() => { isFirstLoad.current = false; }, 0); });
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
    setBanners(prev => prev.map(b => b.slot === oldName ? { ...b, slot: newName } : b));
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

  const isToday = (date) => {
    const n = new Date();
    return date.getFullYear()===n.getFullYear() && date.getMonth()===n.getMonth() && date.getDate()===n.getDate();
  };

  const displaySlots = showOnlyVisible ? allSlots.filter(s => visibleSlots[s]) : allSlots;
  const filteredBanners = banners.filter(b => activeTab === '전체' || getStatus(b.start, b.end) === activeTab);

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
    const onUp = () => { setDragging(null); setDropTargetSlot(null); };
    if (dragging) { window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); }
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const startEdit = (e, banner) => { e.stopPropagation(); e.preventDefault(); setEditingId(banner.id); setEditForm({ name: banner.name, dept: banner.dept || '' }); };
  const commitEdit = () => { if (!editingId) return; setBanners(prev => prev.map(b => b.id === editingId ? { ...b, name: editForm.name, dept: editForm.dept } : b)); setEditingId(null); };
  const cancelEdit = () => setEditingId(null);

  const handleSave = () => {
    setSaving(true);
    fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'save', data: banners }) })
      .finally(() => { setSaving(false); setHasUnsaved(false); });
  };

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
        <div className="flex items-center gap-2.5">
          {hasUnsaved && !saving && (
            <span className="text-[11px] text-amber-500 font-semibold flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
              저장되지 않은 변경사항
            </span>
          )}
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer font-medium">
            <input type="checkbox" checked={showOnlyVisible} onChange={(e) => setShowOnlyVisible(e.target.checked)} className="w-3.5 h-3.5 rounded cursor-pointer" />
            활성 구좌만 보기
          </label>
          <div className="relative">
            {hasUnsaved && !saving && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3 z-10">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400" />
              </span>
            )}
            <button onClick={handleSave}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold shadow-sm transition-all active:scale-95
                ${saving ? 'bg-emerald-300 cursor-not-allowed text-white' : hasUnsaved ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}>
              <Save size={13} className={saving ? 'animate-pulse' : ''} />
              {saving ? '저장 중...' : hasUnsaved ? '저장 필요!' : '저장'}
            </button>
          </div>
          <button onClick={() => {
            const id = Date.now().toString();
            setBanners([...banners, { id, name: '새 배너', slot: allSlots[0], start: makeDefaultDatetime(0), end: makeDefaultDatetime(4, true), dept: '', color: '#DBEAFE', memo: '' }]);
          }} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-sm transition-all active:scale-95">
            <Plus size={13} /> 배너 추가
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
                    className={`h-12 border-b border-slate-50 transition-colors ${visibleSlots[slot] ? '' : 'opacity-25'} ${dropTargetSlot === slot ? 'bg-blue-50/40' : ''}`}>
                    <td className={`sticky left-0 z-30 border-r border-slate-100 px-3 h-12 shadow-[1px_0_0_0_#f1f5f9] transition-colors ${dropTargetSlot === slot ? 'bg-blue-50' : 'bg-white'}`}>
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
                                    top: '8px', left: '3px', height: '28px',
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

                                  {/* 일반 보기 */}
                                  {!isEditingThis && (
                                    <div className="flex items-center w-full h-full px-2 gap-1.5">
                                      <svg width="7" height="11" viewBox="0 0 7 11" fill="currentColor" className="flex-shrink-0 text-slate-500/50 pointer-events-none">
                                        <circle cx="1.5" cy="1.5" r="1.2"/><circle cx="5.5" cy="1.5" r="1.2"/>
                                        <circle cx="1.5" cy="5.5" r="1.2"/><circle cx="5.5" cy="5.5" r="1.2"/>
                                        <circle cx="1.5" cy="9.5" r="1.2"/><circle cx="5.5" cy="9.5" r="1.2"/>
                                      </svg>
                                      <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden pointer-events-none">
                                        {hasCollision && <AlertCircle size={11} className="text-red-500 animate-pulse flex-shrink-0" />}
                                        {banner.dept && (
                                          <span className="text-[9px] px-1.5 py-0.5 bg-black/10 rounded-full font-bold text-slate-600 whitespace-nowrap flex-shrink-0">
                                            {banner.dept}
                                          </span>
                                        )}
                                        <span className="text-[11px] font-semibold text-slate-700 truncate">{banner.name}</span>
                                      </div>
                                      <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => startEdit(e, banner)}
                                        className="flex-shrink-0 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-white/90 hover:bg-white rounded-md p-0.5 shadow-sm border border-black/5 z-40">
                                        <Pencil size={10} className="text-slate-500" />
                                      </button>
                                    </div>
                                  )}

                                  {/* 메모 주황 점 */}
                                  {!isEditingThis && banner.memo && (
                                    <div className="absolute top-1 right-1.5 z-40 pointer-events-none">
                                      <div className="w-2 h-2 rounded-full bg-orange-400 shadow-sm" />
                                    </div>
                                  )}

                                  {/* 호버 툴팁 */}
                                  {!isEditingThis && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/bar:block z-50 pointer-events-none">
                                      <div className="bg-slate-800 text-white text-[11px] rounded-xl px-3 py-2 shadow-xl max-w-[240px] leading-relaxed text-center">
                                        <div className="font-bold">{banner.name}</div>
                                        {banner.memo && <div className="text-slate-300 whitespace-pre-wrap mt-0.5">{banner.memo}</div>}
                                      </div>
                                      <div className="w-2 h-2 bg-slate-800 rotate-45 mx-auto -mt-1" />
                                    </div>
                                  )}

                                  {/* 편집 모드 */}
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
                <button key={tab} onClick={() => setActiveTab(tab)}
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
                {filteredBanners.map(banner => {
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
                          {hasCollision && (
                            <span className="text-[9px] font-bold text-red-400 flex items-center gap-0.5 whitespace-nowrap">
                              <AlertCircle size={9} /> 일정 중첩
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <input className="bg-transparent border-b border-transparent focus:border-blue-400 outline-none font-semibold text-sm text-slate-700 w-full transition-all py-0.5 min-w-[120px]"
                          value={banner.name} onChange={(e) => setBanners(prev => prev.map(b => b.id===banner.id ? {...b, name: e.target.value} : b))} />
                      </td>
                      <td className="px-3 py-3">
                        <input className="bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-100 focus:border-blue-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 w-full text-center transition-all outline-none placeholder:text-slate-300"
                          value={banner.dept||''} placeholder="부서"
                          onChange={(e) => setBanners(prev => prev.map(b => b.id===banner.id ? {...b, dept: e.target.value} : b))} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input type="color" className="w-7 h-7 rounded-lg cursor-pointer border-2 border-white shadow-sm"
                          value={banner.color} onChange={(e) => setBanners(prev => prev.map(b => b.id===banner.id ? {...b, color: e.target.value} : b))} />
                      </td>
                      <td className="px-3 py-3">
                        <select className="bg-white border border-slate-100 rounded-lg px-2 py-1 text-xs outline-none font-medium cursor-pointer focus:ring-1 focus:ring-blue-400 w-full"
                          value={banner.slot} onChange={(e) => setBanners(prev => prev.map(b => b.id===banner.id ? {...b, slot: e.target.value} : b))}>
                          {allSlots.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5 flex-nowrap">
                          <span className="text-[10px] font-bold text-slate-300 whitespace-nowrap">시작</span>
                          <input type="date" className="border border-slate-100 rounded-lg px-1.5 py-1 text-xs focus:ring-1 focus:ring-blue-400 outline-none"
                            value={toDateOnly(banner.start)}
                            onChange={(e) => { const t=banner.start?.slice(11,16)||'00:00'; setBanners(prev => prev.map(b => b.id===banner.id ? {...b, start:`${e.target.value}T${t}`} : b)); }} />
                          <input type="time" className="border border-slate-100 rounded-lg px-1.5 py-1 text-xs focus:ring-1 focus:ring-blue-400 outline-none w-24"
                            value={banner.start?.slice(11,16)||'00:00'}
                            onChange={(e) => { const d=toDateOnly(banner.start); setBanners(prev => prev.map(b => b.id===banner.id ? {...b, start:`${d}T${e.target.value}`} : b)); }} />
                          <span className="text-slate-200 font-bold flex-shrink-0">~</span>
                          <span className="text-[10px] font-bold text-slate-300 whitespace-nowrap">종료</span>
                          <input type="date" className="border border-slate-100 rounded-lg px-1.5 py-1 text-xs focus:ring-1 focus:ring-blue-400 outline-none"
                            value={toDateOnly(banner.end)}
                            onChange={(e) => { const t=banner.end?.slice(11,16)||'23:59'; setBanners(prev => prev.map(b => b.id===banner.id ? {...b, end:`${e.target.value}T${t}`} : b)); }} />
                          <input type="time" className="border border-slate-100 rounded-lg px-1.5 py-1 text-xs focus:ring-1 focus:ring-blue-400 outline-none w-24"
                            value={banner.end?.slice(11,16)||'23:59'}
                            onChange={(e) => { const d=toDateOnly(banner.end); setBanners(prev => prev.map(b => b.id===banner.id ? {...b, end:`${d}T${e.target.value}`} : b)); }} />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <input className="bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-100 focus:border-blue-300 rounded-lg px-2 py-1 text-xs text-slate-600 w-full transition-all outline-none placeholder:text-slate-300 min-w-[120px]"
                          value={banner.memo||''} placeholder="메모 입력..."
                          onChange={(e) => setBanners(prev => prev.map(b => b.id===banner.id ? {...b, memo: e.target.value} : b))} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => setBanners(banners.filter(b => b.id !== banner.id))}
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
        </div>
      </div>
    </div>
  );
};

export default App;
