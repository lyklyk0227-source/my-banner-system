import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Calendar, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  ChevronLeft, 
  ChevronRight,
  Layout,
  AlertCircle,
  Save
} from 'lucide-react';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzoHeSt4DxT1m1Oqwiromcldeso49DHDJCtH_JVzVMuKJ2b5Q1GEMig4R_vmvVL-nUMaQ/exec';
const DEFAULT_SLOTS = ['로고 배너', '레이어', '헤더배너', '강조 no.1 (#1)', '강조 no.1 (#2)', '강조 no.1 (#3)', '강조 no.3 (랜덤)'];

const App = () => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 5));
  const [showOnlyVisible, setShowOnlyVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('전체');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [allSlots, setAllSlots] = useState(DEFAULT_SLOTS);
  const [banners, setBanners] = useState([]);
  const [visibleSlots, setVisibleSlots] = useState(
    DEFAULT_SLOTS.reduce((acc, slot) => ({ ...acc, [slot]: true }), {})
  );

  const slotRefs = useRef({});
  const isFirstRender = useRef(true);

  useEffect(() => {
    fetch(SCRIPT_URL)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setBanners(data.map(b => ({ ...b, id: String(b.id) })));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (loading) return;
    setSaving(true);
    fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'save', data: banners }),
    }).finally(() => setSaving(false));
  }, [banners]);

  const checkCollision = useMemo(() => {
    const collisions = {};
    banners.forEach(b1 => {
      const s1 = new Date(b1.start).getTime();
      const e1 = new Date(b1.end).getTime();
      const isColliding = banners.some(b2 => {
        if (b1.id === b2.id || b1.slot !== b2.slot) return false;
        const s2 = new Date(b2.start).getTime();
        const e2 = new Date(b2.end).getTime();
        return s1 <= e2 && s2 <= e1;
      });
      collisions[b1.id] = isColliding;
    });
    return collisions;
  }, [banners]);

  const handleSlotNameChange = (oldName, newName) => {
    if (!newName || oldName === newName) return;
    setAllSlots(prev => prev.map(s => s === oldName ? newName : s));
    setBanners(prev => prev.map(b => b.slot === oldName ? { ...b, slot: newName } : b));
  };

  const formatDate = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getStatus = (startStr, endStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (end < today) return '종료';
    if (start > today) return '대기';
    return '진행중';
  };

  const dateRange = useMemo(() => {
    const range = [];
    for (let i = -10; i <= 20; i++) {
      const d = new Date(currentDate);
      d.setDate(currentDate.getDate() + i);
      range.push(new Date(d.setHours(0, 0, 0, 0)));
    }
    return range;
  }, [currentDate]);

  const viewStart = dateRange[0];
  const viewEnd = dateRange[dateRange.length - 1];

  const isToday = (date) => {
    const now = new Date();
    return date.getFullYear() === now.getFullYear() &&
           date.getMonth() === now.getMonth() &&
           date.getDate() === now.getDate();
  };

  const displaySlots = showOnlyVisible
    ? allSlots.filter(slot => visibleSlots[slot])
    : allSlots;

  const filteredBanners = banners.filter(banner => {
    if (activeTab === '전체') return true;
    return getStatus(banner.start, banner.end) === activeTab;
  });

  const [dragging, setDragging] = useState(null);
  const [dropTargetSlot, setDropTargetSlot] = useState(null);

  const handleMouseDown = (e, banner, type) => {
    e.stopPropagation();
    const slotLayouts = {};
    displaySlots.forEach(slot => {
      const el = slotRefs.current[slot];
      if (el) {
        const rect = el.getBoundingClientRect();
        slotLayouts[slot] = { top: rect.top, bottom: rect.bottom };
      }
    });
    setDragging({
      id: banner.id, type,
      startX: e.clientX, startY: e.clientY,
      initialStart: new Date(banner.start),
      initialEnd: new Date(banner.end),
      initialSlot: banner.slot,
      slotLayouts
    });
    setDropTargetSlot(banner.slot);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragging) return;
      const deltaX = e.clientX - dragging.startX;
      const daysDiff = Math.round(deltaX / 40);
      let newSlot = dragging.initialSlot;
      if (dragging.type === 'move') {
        for (const [slotName, rect] of Object.entries(dragging.slotLayouts)) {
          if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
            newSlot = slotName; break;
          }
        }
        setDropTargetSlot(newSlot);
      }
      setBanners(prev => prev.map(b => {
        if (b.id !== dragging.id) return b;
        let newStart = new Date(dragging.initialStart);
        let newEnd = new Date(dragging.initialEnd);
        if (dragging.type === 'move') {
          newStart.setDate(newStart.getDate() + daysDiff);
          newEnd.setDate(newEnd.getDate() + daysDiff);
        } else if (dragging.type === 'resize-start') {
          newStart.setDate(newStart.getDate() + daysDiff);
          if (newStart >= newEnd) newStart = new Date(new Date(newEnd).setDate(newEnd.getDate() - 1));
        } else if (dragging.type === 'resize-end') {
          newEnd.setDate(newEnd.getDate() + daysDiff);
          if (newEnd <= newStart) newEnd = new Date(new Date(newStart).setDate(newStart.getDate() + 1));
        }
        return { ...b, start: formatDate(newStart), end: formatDate(newEnd), slot: newSlot };
      }));
    };
    const handleMouseUp = () => { setDragging(null); setDropTargetSlot(null); };
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">데이터 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen bg-gray-50 text-slate-800 overflow-hidden font-sans select-none ${dragging ? 'cursor-grabbing' : ''}`}>
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b shadow-sm z-50">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            배너 운영 현황 관리
            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">v1.0</span>
            {saving && (
              <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
                <Save size={10} className="animate-pulse" /> 저장 중...
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 text-sm font-medium">
            <ChevronLeft className="cursor-pointer hover:text-blue-600 transition-colors" onClick={() => {
              const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d);
            }} />
            <div className="flex items-center gap-1 min-w-[90px] justify-center font-bold">
              <Calendar size={14} className="text-blue-500" />
              {currentDate.getFullYear()}. {currentDate.getMonth() + 1}
            </div>
            <ChevronRight className="cursor-pointer hover:text-blue-600 transition-colors" onClick={() => {
              const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d);
            }} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 bg-white border px-4 py-2 rounded-lg text-sm cursor-pointer shadow-sm hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={showOnlyVisible}
              onChange={(e) => setShowOnlyVisible(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="font-semibold text-slate-600">활성 구좌만 보기</span>
          </label>
          <button
            onClick={() => {
              const id = Date.now().toString();
              setBanners([...banners, {
                id, name: '새 배너', slot: allSlots[0],
                start: formatDate(new Date()),
                end: formatDate(new Date(Date.now() + 86400000 * 4)),
                dept: '기타', color: '#E2E8F0', memo: ''
              }]);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold shadow-md transition-all active:scale-95"
          >
            <Plus size={18} /> 배너 추가
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto overflow-y-hidden">
            <table className="w-full border-collapse table-fixed min-w-max">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="w-52 sticky left-0 z-40 bg-slate-50 border-r p-3 text-xs font-bold text-slate-400 uppercase tracking-wider text-left shadow-[1px_0_0_0_#e2e8f0]">
                    구좌 리스트
                  </th>
                  {dateRange.map((date, idx) => (
                    <th key={idx} className={`w-[40px] border-r p-2 text-center text-xs font-semibold ${date.getDay() === 0 ? 'text-red-500' : date.getDay() === 6 ? 'text-blue-500' : 'text-slate-400'} ${isToday(date) ? 'bg-blue-50' : ''}`}>
                      <div className="opacity-60 mb-1">{['일','월','화','수','목','금','토'][date.getDay()]}</div>
                      <div className={isToday(date) ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center mx-auto' : ''}>
                        {date.getDate()}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displaySlots.map(slot => (
                  <tr
                    key={slot}
                    ref={el => slotRefs.current[slot] = el}
                    className={`h-14 border-b group transition-colors ${visibleSlots[slot] ? '' : 'opacity-30 bg-slate-50'} ${dropTargetSlot === slot ? 'bg-blue-50/50' : ''}`}
                  >
                    <td className={`sticky left-0 z-30 border-r px-4 flex items-center justify-between h-14 shadow-[2px_0_5px_rgba(0,0,0,0.02)] transition-colors ${dropTargetSlot === slot ? 'bg-blue-100/50' : 'bg-white'}`}>
                      <input
                        className={`text-sm font-bold bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-blue-200 rounded px-1 w-full transition-all ${visibleSlots[slot] ? 'text-slate-600' : 'text-slate-400 line-through'}`}
                        defaultValue={slot}
                        onBlur={(e) => handleSlotNameChange(slot, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                      />
                      <button
                        onClick={() => setVisibleSlots(v => ({ ...v, [slot]: !v[slot] }))}
                        className={`p-1.5 rounded transition-colors ml-1 ${visibleSlots[slot] ? 'text-slate-300 hover:text-blue-500 hover:bg-white' : 'text-blue-500 bg-blue-50'}`}
                      >
                        {visibleSlots[slot] ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </td>
                    {dateRange.map((date, idx) => {
                      const dateStr = formatDate(date);
                      return (
                        <td key={idx} className={`border-r relative ${isToday(date) ? 'bg-blue-50/20' : ''}`}>
                          {isToday(date) && <div className="absolute inset-y-0 left-1/2 w-0.5 bg-blue-400/30 z-0 pointer-events-none"></div>}
                          {visibleSlots[slot] && banners
                            .filter(b => {
                              const bStart = new Date(b.start);
                              const bEnd = new Date(b.end);
                              if (bStart < viewStart) {
                                return b.slot === slot && idx === 0 && bEnd >= viewStart;
                              }
                              return b.slot === slot && b.start === dateStr;
                            })
                            .map(banner => {
                              const bStart = new Date(banner.start);
                              const bEnd = new Date(banner.end);
                              const actualDisplayStart = bStart < viewStart ? viewStart : bStart;
                              const actualDisplayEnd = bEnd > viewEnd ? viewEnd : bEnd;
                              const duration = Math.round((actualDisplayEnd - actualDisplayStart) / 86400000) + 1;
                              const hasCollision = checkCollision[banner.id];
                              const isDraggingThis = dragging?.id === banner.id;
                              return (
                                <div
                                  key={banner.id}
                                  onMouseDown={(e) => handleMouseDown(e, banner, 'move')}
                                  style={{
                                    width: `calc(${duration * 40}px - 4px)`,
                                    backgroundColor: banner.color,
                                    top: '10px', left: '2px',
                                    zIndex: isDraggingThis ? 1000 : 20,
                                    opacity: isDraggingThis ? 0.8 : 1,
                                    transform: isDraggingThis ? 'scale(1.02)' : 'none'
                                  }}
                                  className={`absolute h-8 rounded-lg shadow-sm border border-black/10 cursor-grab active:cursor-grabbing flex items-center overflow-hidden transition-all ring-1 ring-inset ${hasCollision ? 'ring-red-500 ring-2' : 'ring-black/5'} ${isDraggingThis ? 'shadow-xl brightness-105' : 'hover:brightness-95'}`}
                                >
                                  <div className="absolute left-0 top-0 w-2 h-full cursor-ew-resize hover:bg-black/10 z-30" onMouseDown={(e) => handleMouseDown(e, banner, 'resize-start')} />
                                  <div className="flex items-center px-3 w-full h-full pointer-events-none gap-2">
                                    {hasCollision && <AlertCircle size={12} className="text-red-600 animate-pulse flex-shrink-0" />}
                                    {banner.dept && (
                                      <span className="text-[9px] px-1 bg-black/10 rounded font-black text-slate-700 whitespace-nowrap">[{banner.dept}]</span>
                                    )}
                                    <span className="text-[11px] font-bold text-slate-800 truncate drop-shadow-sm">{banner.name}</span>
                                  </div>
                                  <div className="absolute right-0 top-0 w-2 h-full cursor-ew-resize hover:bg-black/10 z-30" onMouseDown={(e) => handleMouseDown(e, banner, 'resize-end')} />
                                </div>
                              );
                            })
                          }
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b flex justify-between items-center bg-white flex-wrap gap-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2 text-base">
              <Layout size={18} className="text-blue-500" />
              배너 데이터 상세 설정
              <span className="text-blue-500 text-xs px-2 py-0.5 bg-blue-50 rounded-full border border-blue-100 font-semibold ml-1">Total {filteredBanners.length}</span>
            </h2>
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-inner">
              {['전체', '진행중', '대기', '종료'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b">
                <tr>
                  <th className="p-4 w-32 text-center">현재 상태</th>
                  <th className="p-4 min-w-[200px]">배너 명칭</th>
                  <th className="p-4 w-16 text-center">색상</th>
                  <th className="p-4 w-44">노출 구좌</th>
                  <th className="p-4 w-52 text-center">노출 기간</th>
                  <th className="p-4 w-32 text-left">담당 부서</th>
                  <th className="p-4 w-16 text-center">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {filteredBanners.map(banner => {
                  const status = getStatus(banner.start, banner.end);
                  const hasCollision = checkCollision[banner.id];
                  return (
                    <tr key={banner.id} className={`hover:bg-slate-50/50 transition-colors group ${hasCollision ? 'bg-red-50/30' : ''}`}>
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border block text-center w-full ${status === '진행중' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : status === '대기' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            {status}
                          </span>
                          {hasCollision && (
                            <span className="text-[9px] font-black text-red-500 flex items-center gap-0.5 mt-1">
                              <AlertCircle size={10} /> 일정 중첩
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <input className="bg-transparent border-b border-transparent focus:border-blue-500 outline-none font-semibold w-full transition-all py-1" value={banner.name} onChange={(e) => setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, name: e.target.value } : b))} />
                      </td>
                      <td className="p-4 text-center">
                        <input type="color" className="w-8 h-8 rounded-lg cursor-pointer border-2 border-white shadow-sm" value={banner.color} onChange={(e) => setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, color: e.target.value } : b))} />
                      </td>
                      <td className="p-4">
                        <select className="bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs outline-none font-medium cursor-pointer focus:ring-1 focus:ring-blue-500 w-full" value={banner.slot} onChange={(e) => setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, slot: e.target.value } : b))}>
                          {allSlots.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2 text-[11px]">
                          <input type="date" className="border border-slate-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-blue-500 outline-none w-24" value={banner.start} onChange={(e) => setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, start: e.target.value } : b))} />
                          <span className="text-slate-400 font-bold">~</span>
                          <input type="date" className="border border-slate-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-blue-500 outline-none w-24" value={banner.end} onChange={(e) => setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, end: e.target.value } : b))} />
                        </div>
                      </td>
                      <td className="p-4">
                        <input
                          className="bg-slate-100 hover:bg-slate-200 focus:bg-white border border-transparent focus:border-blue-500 rounded px-3 py-1.5 text-[11px] font-bold text-slate-600 w-full text-left transition-all outline-none"
                          value={banner.dept || ''}
                          placeholder="부서 입력"
                          onChange={(e) => setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, dept: e.target.value } : b))}
                        />
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => setBanners(banners.filter(b => b.id !== banner.id))} className="text-slate-300 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-md">
                          <Trash2 size={16} />
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
