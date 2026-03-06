import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Calendar, Plus, Trash2, Eye, EyeOff,
  ChevronLeft, ChevronRight, Layout,
  AlertCircle, Check, X, Lock, Loader, BookOpen
} from 'lucide-react';

// Firebase 설정
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAX8YJewMt8BExZMiNXr1-ODWGgGo8_Zvs",
  authDomain: "my-banner-34fbd.firebaseapp.com",
  projectId: "my-banner-34fbd",
  storageBucket: "my-banner-34fbd.firebasestorage.app",
  messagingSenderId: "850066679550",
  appId: "1:850066679550:web:67f5aab5a0b0d26ec327af"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const DEFAULT_SLOTS = ['로고 배너', '레이어', '헤더 배너', '강조형 no.1 (#1)', '강조형 no.2 (#2)', '강조형 no.1 (#3)', '강조형 no.2', '강조형 no.3', '띠 배너 (#1)', '띠 배너 (#2)', '플로팅 배너 (#1)', '플로팅 배너 (#2)', '플로팅 배너 (#3)'];
const PASSWORD = '1004';

const HOLIDAYS = new Set([
  // 2025 공휴일 및 대체휴무
  '2025-01-01', // 신정
  '2025-01-28','2025-01-29','2025-01-30', // 설날
  '2025-03-01', // 삼일절
  '2025-05-05', // 어린이날
  '2025-05-06', // 어린이날 대체
  '2025-05-15', // 부처님오신날
  '2025-06-06', // 현충일
  '2025-08-15', // 광복절
  '2025-10-03', // 개천절
  '2025-10-05','2025-10-06','2025-10-07', // 추석
  '2025-10-08', // 추석 대체
  '2025-10-09', // 한글날
  '2025-12-25', // 성탄절
  // 2026 공휴일 및 대체휴무
  '2026-01-01', // 신정
  '2026-02-16','2026-02-17','2026-02-18', // 설날
  '2026-03-01', // 삼일절
  '2026-03-02', // 삼일절 대체
  '2026-05-05', // 어린이날
  '2026-05-24', // 부처님오신날
  '2026-06-06', // 현충일
  '2026-08-15', // 광복절
  '2026-08-17', // 광복절 대체
  '2026-09-24','2026-09-25','2026-09-26', // 추석
  '2026-10-03', // 개천절
  '2026-10-09', // 한글날
  '2026-12-25', // 성탄절
  // 2027 공휴일 및 대체휴무
  '2027-01-01', // 신정
  '2027-02-06','2027-02-07','2027-02-08', // 설날
  '2027-03-01', // 삼일절
  '2027-05-05', // 어린이날
  '2027-05-13', // 부처님오신날
  '2027-06-06', // 현충일
  '2027-08-15', // 광복절
  '2027-08-16', // 광복절 대체
  '2027-09-14','2027-09-15','2027-09-16', // 추석
  '2027-10-03', // 개천절
  '2027-10-04', // 개천절 대체
  '2027-10-09', // 한글날
  '2027-10-11', // 한글날 대체
  '2027-12-25', // 성탄절
]);

// 배경색 밝기 계산 → 텍스트 색상 결정
// 구좌 그룹 정의
const SLOT_GROUPS = [
  { label: null, slots: ['로고 배너', '레이어', '헤더 배너'] },
  { label: '강조형', slots: ['강조형 no.1 (#1)', '강조형 no.2 (#2)', '강조형 no.1 (#3)', '강조형 no.2', '강조형 no.3'] },
  { label: '띠 배너', slots: ['띠 배너 (#1)', '띠 배너 (#2)'] },
  { label: '플로팅 배너', slots: ['플로팅 배너 (#1)', '플로팅 배너 (#2)', '플로팅 배너 (#3)'] },
];
const getSlotGroup = (slot) => SLOT_GROUPS.find(g => g.slots.includes(slot));
const isFirstInGroup = (slot, allSlots) => {
  const group = getSlotGroup(slot);
  if (!group || !group.label) return false;
  const firstVisible = group.slots.find(s => allSlots.includes(s));
  return firstVisible === slot;
};

const getLuma = (hex) => {
  const h = (hex||'#DBEAFE').replace('#','');
  const r = parseInt(h.slice(0,2),16)/255;
  const g = parseInt(h.slice(2,4),16)/255;
  const b = parseInt(h.slice(4,6),16)/255;
  const toLinear = c => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4);
  return 0.2126*toLinear(r) + 0.7152*toLinear(g) + 0.0722*toLinear(b);
};
const isDark = (hex) => getLuma(hex) < 0.35;

const normalizeDateTime = (str) => {
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str)) return str;
  if (str.length >= 16) return str.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return `${str}T00:00`;
  return str;
};
const toDateOnly = (str) => str ? str.slice(0, 10) : '';

/* ─────────────────────────────────────────
   색상 팔레트 팝오버
───────────────────────────────────────── */
const PASTEL_COLORS = [
  '#DBEAFE','#EDE9FE','#FCE7F3','#D1FAE5','#FEF3C7','#FFE4E6','#E0F2FE',
];

const ColorPicker = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleOpen = (e) => {
    e.stopPropagation();
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
    }
    setOpen(o => !o);
  };

  return (
    <div className="inline-block" ref={triggerRef}>
      <button onClick={handleOpen}
        className="w-7 h-7 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-110 block"
        style={{ backgroundColor: value }} />
      {open && (
        <div onMouseDown={(e) => e.stopPropagation()}
          className="fixed bg-white rounded-2xl shadow-xl border border-slate-100 p-2.5 flex items-center gap-1.5"
          style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)', zIndex: 99999 }}>
          {['#DBEAFE','#EDE9FE','#FCE7F3','#D1FAE5','#FEF3C7','#FFE4E6'].map(c => (
            <button key={c} onClick={(e) => { e.stopPropagation(); onChange(c); setOpen(false); }}
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 flex-shrink-0 ${value === c ? 'border-slate-400 scale-110' : 'border-white shadow-sm'}`}
              style={{ backgroundColor: c }} />
          ))}
          <label className="cursor-pointer flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors flex-shrink-0" title="직접 선택">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/>
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
            </svg>
            <input type="color" className="sr-only" value={value} onChange={(e) => { onChange(e.target.value); setOpen(false); }} onClick={(e) => e.stopPropagation()}/>
          </label>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────
   연월 선택 네비게이터
───────────────────────────────────────── */
const DateNavigator = ({ currentDate, setCurrentDate }) => {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentDate.getFullYear());
  const ref = useRef(null);

  useEffect(() => {
    if (open) setPickerYear(currentDate.getFullYear());
  }, [open]);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectMonth = (year, month) => {
    const d = new Date(currentDate);
    d.setFullYear(year);
    d.setMonth(month);
    setCurrentDate(d);
    setOpen(false);
  };

  const isCurrentMonth = (year, month) =>
    currentDate.getFullYear() === year && currentDate.getMonth() === month;

  const now = new Date();
  const isTodayMonth = (year, month) =>
    now.getFullYear() === year && now.getMonth() === month;

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-1 bg-slate-100 px-2.5 py-1.5 rounded-full">
        <ChevronLeft size={14} className="cursor-pointer text-slate-400 hover:text-blue-500 transition-colors"
          onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()-1); setCurrentDate(d); }} />
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 font-semibold text-slate-600 min-w-[80px] justify-center text-xs hover:text-blue-500 transition-colors">
          <Calendar size={12} className="text-blue-400 flex-shrink-0" />
          {currentDate.getFullYear()}. {String(currentDate.getMonth()+1).padStart(2,'0')}
        </button>
        <ChevronRight size={14} className="cursor-pointer text-slate-400 hover:text-blue-500 transition-colors"
          onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()+1); setCurrentDate(d); }} />
      </div>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 w-[300px]">
          <div className="flex items-center justify-between mb-2.5">
            <button onClick={() => setPickerYear(y => y-1)}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-500 transition-colors">
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs font-bold text-slate-600">{pickerYear}년</span>
            <button onClick={() => setPickerYear(y => y+1)}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-500 transition-colors">
              <ChevronRight size={13} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {Array.from({length:12},(_,i)=>i).map(m => (
              <button key={m}
                onClick={() => selectMonth(pickerYear, m)}
                className={`py-1.5 px-1 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap
                  ${isCurrentMonth(pickerYear, m)
                    ? 'bg-blue-500 text-white shadow-sm'
                    : isTodayMonth(pickerYear, m)
                    ? 'bg-blue-50 text-blue-500 border border-blue-200'
                    : 'text-slate-500 hover:bg-slate-100'}`}>
                {m+1}월
              </button>
            ))}
          </div>
          <button
            onClick={() => { setCurrentDate(new Date()); setOpen(false); }}
            className="w-full py-1.5 rounded-xl text-xs font-bold text-blue-500 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-100">
            오늘로 이동
          </button>
        </div>
      )}
    </div>
  );
};

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
      setError(true); setShake(true); setPw('');
      setTimeout(() => setShake(false), 500);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #eef2ff 50%, #f0f9ff 100%)' }}>
      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
        @keyframes float { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-8px)} }
        .float { animation: float 3s ease-in-out infinite; }
      `}</style>
      <div className="absolute top-[-80px] left-[-80px] w-72 h-72 rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #93c5fd, transparent)' }} />
      <div className="absolute bottom-[-60px] right-[-60px] w-64 h-64 rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #a5b4fc, transparent)' }} />
      <div className={`relative bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white px-10 py-12 w-full max-w-sm`}
        style={shake ? { animation: 'shake 0.4s ease' } : {}}>
        <div className="flex flex-col items-center mb-8">
          <div className="float w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-lg shadow-blue-100"
            style={{ background: 'linear-gradient(135deg, #60a5fa, #818cf8)' }}>🍦</div>
          <h1 className="text-xl font-extrabold tracking-tight"
            style={{ background: 'linear-gradient(90deg, #3b82f6, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>배너 일정 관리</h1>
          <p className="text-[10px] text-slate-400 mt-1 tracking-widest uppercase font-medium">i-Scream · Banner Scheduler</p>
        </div>
        <div className="space-y-3">
          <div className="relative">
            <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
            <input ref={inputRef} type="password" placeholder="비밀번호를 입력하세요" value={pw}
              onChange={(e) => { setPw(e.target.value); setError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className={`w-full pl-9 pr-4 py-3 rounded-2xl border text-sm outline-none transition-all bg-slate-50/80
                ${error ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-200' : 'border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100'}`} />
          </div>
          {error && <p className="text-xs text-red-400 text-center font-medium">비밀번호가 올바르지 않아요</p>}
          <button onClick={handleSubmit}
            className="w-full text-white py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-md shadow-blue-200"
            style={{ background: 'linear-gradient(90deg, #3b82f6, #6366f1)' }}>로그인</button>
        </div>
        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <a href="https://concise-quarter-a1a.notion.site/17641177fa2a802f8c71f459bc6fa5d4"
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-500 transition-colors font-medium">
            <BookOpen size={12} />배너 제작 가이드 보기
          </a>
        </div>
      </div>
      <p className="absolute bottom-6 text-[11px] text-slate-400 font-medium tracking-wide">by.lyk</p>
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
  const [saveStatus, setSaveStatus] = useState('idle');

  const [allSlots, setAllSlots] = useState(DEFAULT_SLOTS);
  const [banners, setBanners] = useState([]);
  const [visibleSlots, setVisibleSlots] = useState(
    DEFAULT_SLOTS.reduce((acc, s) => ({ ...acc, [s]: true }), {})
  );

  const isFirstLoad = useRef(true);
  const bannersRef = useRef([]);

  const saveTimerRef = useRef(null);

  const doSave = useCallback((data) => {
    clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    setDoc(doc(db, 'banners', 'data'), { list: data })
      .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); })
      .catch(() => setSaveStatus('error'));
  }, []);

  const triggerSave = useCallback((data) => {
    if (isFirstLoad.current) return;
    if (draggingRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(data), 3000);
  }, [doSave]);

  const updateBanners = useCallback((fn) => {
    setBanners(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      bannersRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (isFirstLoad.current) return;
    if (draggingRef.current) return;
    triggerSave(banners);
  }, [banners]);

  useEffect(() => {
    const handleUnload = () => {
      if (isFirstLoad.current || bannersRef.current.length === 0) return;
      clearTimeout(saveTimerRef.current);
      setDoc(doc(db, 'banners', 'data'), { list: bannersRef.current });
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', dept: '' });
  const nameInputRef = useRef(null);
  const deptInputRef = useRef(null);
  const slotRefs = useRef({});
  const cellWidthRef = useRef(40);
  const [cellWidth, setCellWidth] = useState(40);
  const ganttContainerRef = useRef(null);

  useEffect(() => {
    if (loading) return;
    const measure = () => {
      if (!ganttContainerRef.current) return;
      const th = ganttContainerRef.current.querySelector('thead th:nth-child(2)');
      if (th) {
        const w = th.getBoundingClientRect().width;
        if (w > 0 && w !== cellWidthRef.current) {
          cellWidthRef.current = w;
          setCellWidth(w);
        }
      }
    };
    let raf1, raf2;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(measure);
    });
    const onResize = () => requestAnimationFrame(measure);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.removeEventListener('resize', onResize);
    };
  }, [loading]);

  // Firebase에서 데이터 로드
  useEffect(() => {
    getDoc(doc(db, 'banners', 'data')).then(snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.data().list || [];
        const loaded = data.map(b => ({ ...b, id: String(b.id), start: normalizeDateTime(b.start), end: normalizeDateTime(b.end) }));
        setBanners(loaded);
        bannersRef.current = loaded;
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
    const dateOnly = str.slice(0, 10);
    const d = new Date(dateOnly + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T00:00`;
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

  const viewStart = dateRange[0];
  const viewEnd = dateRange[dateRange.length - 1];
  const isToday = (date) => { const n = new Date(); return date.getFullYear()===n.getFullYear()&&date.getMonth()===n.getMonth()&&date.getDate()===n.getDate(); };
  const [sortBy, setSortBy] = useState('start');
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const [colorPickerId, setColorPickerId] = useState(null);

  const displaySlots = showOnlyVisible ? allSlots.filter(s => visibleSlots[s]) : allSlots;
  const filteredBanners = banners
    .filter(b => activeTab === '전체' || getStatus(b.start, b.end) === activeTab)
    .filter(b => !searchQuery || b.name.includes(searchQuery) || (b.dept||'').includes(searchQuery) || b.slot.includes(searchQuery))
    .sort((a, b) => {
      if (!sortBy) return 0;
      const key = sortBy.replace('-', '');
      const dir = sortBy.startsWith('-') ? -1 : 1;
      if (key === 'start') return dir * (new Date(a.start) - new Date(b.start));
      if (key === 'end') return dir * (new Date(a.end) - new Date(b.end));
      if (key === 'name') return dir * a.name.localeCompare(b.name, 'ko');
      if (key === 'slot') return dir * (allSlots.indexOf(a.slot) - allSlots.indexOf(b.slot));
      if (key === 'status') return dir * getStatus(a.start, a.end).localeCompare(getStatus(b.start, b.end));
      if (key === 'dept') return dir * (a.dept||'').localeCompare(b.dept||'', 'ko');
      return 0;
    });
  const totalPages = Math.ceil(filteredBanners.length / PAGE_SIZE);
  const pagedBanners = filteredBanners.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const [dragging, setDragging] = useState(null);
  const draggingRef = useRef(null);
  const [dropTargetSlot, setDropTargetSlot] = useState(null);

  const handleMouseDown = (e, banner, type) => {
    if (editingId) return;
    e.stopPropagation();
    const slotLayouts = {};
    displaySlots.forEach(slot => {
      const el = slotRefs.current[slot];
      if (el) { const r = el.getBoundingClientRect(); slotLayouts[slot] = { top: r.top, bottom: r.bottom }; }
    });
    const normDate = (s) => s.slice(0, 10) + 'T00:00';
    const cw = cellWidthRef.current;
    const snappedX = Math.round(e.clientX / cw) * cw;
    const dragObj = { id: banner.id, type, startX: snappedX, startY: e.clientY, initialStart: normDate(banner.start), initialEnd: normDate(banner.end), initialSlot: banner.slot, slotLayouts };
    draggingRef.current = dragObj;
    setDragging(dragObj);
    setDropTargetSlot(banner.slot);
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging) return;
      const cw = cellWidthRef.current;
      const days = Math.floor((e.clientX - dragging.startX + cw / 2) / cw);
      let newSlot = dragging.initialSlot;
      if (dragging.type === 'move') {
        for (const [s, r] of Object.entries(dragging.slotLayouts)) {
          if (e.clientY >= r.top && e.clientY <= r.bottom) { newSlot = s; break; }
        }
        setDropTargetSlot(newSlot);
      }

      updateBanners(prev => prev.map(b => {
        if (b.id !== dragging.id) return b;
        let ns = dragging.initialStart, ne = dragging.initialEnd;
        if (dragging.type === 'move') { ns = shiftDateTime(ns, days); ne = shiftDateTime(ne, days); }
        else if (dragging.type === 'resize-start') { ns = shiftDateTime(ns, days); if (new Date(ns) >= new Date(ne)) ns = shiftDateTime(ne, -1); }
        else if (dragging.type === 'resize-end') { ne = shiftDateTime(ne, days); if (new Date(ne) <= new Date(ns)) ne = shiftDateTime(ns, 1); }
        return { ...b, start: ns, end: ne, slot: newSlot };
      }));
    };
    const onUp = () => {
      draggingRef.current = null;
      setDragging(null);
      setDropTargetSlot(null);
      if (!isFirstLoad.current && bannersRef.current.length > 0) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => doSave(bannersRef.current), 1000);
      }
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
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-sm shadow-blue-200 text-base">🍦</div>
            <div>
              <h1 className="text-sm font-extrabold leading-tight tracking-tight"
                style={{ background: 'linear-gradient(90deg, #3b82f6, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>배너 일정 관리</h1>
              <p className="text-[9px] text-slate-400 leading-tight tracking-widest uppercase font-medium">i-Scream · Banner Scheduler</p>
            </div>
          </div>
          <DateNavigator currentDate={currentDate} setCurrentDate={setCurrentDate} />
          <p className="text-[11px] text-slate-400 font-medium">
            바를 드래그해 이동하거나, 양 끝을 늘려 기간을 조절할 수 있어요
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1.5 text-slate-400">
                <div className="w-3 h-3 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                저장 중
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 text-emerald-500">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                저장 완료
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1.5 text-red-400">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                저장 실패
              </span>
            )}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer font-medium">
            <input type="checkbox" checked={showOnlyVisible} onChange={(e) => setShowOnlyVisible(e.target.checked)} className="w-3.5 h-3.5 rounded cursor-pointer" />
            활성 구좌만 보기
          </label>
          <button onClick={() => {
            const id = Date.now().toString();
            updateBanners(prev => [...prev, { id, name: '새 배너', slot: allSlots.find(s => visibleSlots[s]) || allSlots[0], start: makeDefaultDatetime(0), end: makeDefaultDatetime(4, true), dept: '', color: '#DBEAFE', memo: '' }]);
          }} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-sm transition-all active:scale-95">
            <Plus size={13} /> 배너 추가
          </button>

        </div>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-5">

        {/* 간트차트 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto overflow-y-hidden" ref={el => { if (el) ganttContainerRef.current = el; }}>
            <table className="w-full border-collapse table-fixed min-w-max">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="w-44 sticky left-0 z-40 bg-white border-r border-slate-100 p-3 text-left">
                    <span className="text-[11px] font-bold text-slate-400">구좌 리스트</span>
                  </th>
                  {dateRange.map((date, idx) => {
                    const today = isToday(date), isSun = date.getDay()===0, isSat = date.getDay()===6;
                    const dateKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
                    const isHoliday = HOLIDAYS.has(dateKey);
                    const isRed = isSun || isHoliday;
                    return (
                      <th key={idx} style={{borderRight:'1px dashed #e2e8f0'}} className={`w-[40px] p-1 text-center ${today ? 'bg-blue-50' : isRed && !today ? 'bg-red-50/40' : ''}`}>
                        <div className={`text-[11px] font-bold mb-0.5 ${isRed ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-slate-500'}`}>
                          {['일','월','화','수','목','금','토'][date.getDay()]}
                        </div>
                        {today
                          ? <div className="bg-blue-500 text-white text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center mx-auto">{date.getDate()}</div>
                          : <div className={`text-[12px] font-semibold ${isRed ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-slate-500'}`}>{date.getDate()}</div>
                        }
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {displaySlots.map(slot => (
                  <tr key={slot} ref={el => slotRefs.current[slot] = el}
                    className={`h-8 border-b border-slate-100 transition-colors ${visibleSlots[slot] ? '' : 'opacity-70'} ${dropTargetSlot === slot ? 'bg-blue-50/40' : ''}`}>
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
                      const cellIsHoliday = HOLIDAYS.has(dateStr);
                      const cellIsRed = date.getDay() === 0 || cellIsHoliday;
                      return (
                        <td key={idx} style={{borderRight:'1px dashed #e2e8f0'}} className={`relative ${isToday(date) ? 'bg-blue-50/30' : cellIsRed ? 'bg-red-50/30' : ''}`}>
                          {isToday(date) && <div className="absolute inset-y-0 left-1/2 w-0.5 bg-blue-400/70 z-0 pointer-events-none" />}
                          {visibleSlots[slot] && banners
                            .filter(b => {
                              const bDateOnly = toDateOnly(b.start), bEndOnly = toDateOnly(b.end);
                              const viewStartStr = formatDateOnly(viewStart);
                              if (new Date(bDateOnly) < new Date(viewStartStr)) {
                                return b.slot === slot && idx === 0 && bEndOnly >= viewStartStr;
                              }
                              return b.slot === slot && bDateOnly === dateStr;
                            })
                            .map(banner => {
                              const bStartOnly = toDateOnly(banner.start);
                              const bEndOnly = toDateOnly(banner.end);
                              const viewStartStr = formatDateOnly(viewStart);

                              const dispStart = bStartOnly < viewStartStr ? viewStartStr : bStartOnly;

                              const startMs = new Date(dispStart + 'T12:00:00').getTime();
                              const endMs   = new Date(bEndOnly  + 'T12:00:00').getTime();
                              const duration = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);

                              const hasCollision = collisionInfo[banner.id];
                              const isDraggingThis = dragging?.id === banner.id;
                              const isEditingThis = editingId === banner.id;
                              const isHighlightedBar = highlightedId === banner.id;

                              return (
                                <div key={banner.id}
                                  onMouseDown={(e) => !isEditingThis && handleMouseDown(e, banner, 'move')}
                                  style={{
                                    width: `calc(${duration * cellWidth}px - 4px)`,
                                    backgroundColor: banner.color || '#DBEAFE',
                                    top: '4px', left: '2px', height: '24px',
                                    zIndex: isDraggingThis ? 1000 : isEditingThis ? 200 : 20,
                                    opacity: isDraggingThis ? 0.85 : 1,
                                    transform: isDraggingThis ? 'scale(1.02) translateY(-1px)' : 'none',
                                    minWidth: isEditingThis ? '230px' : undefined,
                                  }}
                                  className={`absolute rounded-xl flex items-center transition-all group/bar border border-white/60 shadow-sm
                                    ${isEditingThis ? 'cursor-default ring-2 ring-blue-400 ring-offset-1' : 'cursor-grab active:cursor-grabbing'}
                                    ${isHighlightedBar && !isEditingThis ? 'ring-2 ring-yellow-400 ring-offset-1 brightness-95' : ''}
                                    ${hasCollision && !isEditingThis ? 'ring-2 ring-red-400 ring-offset-1' : ''}
                                    ${isDraggingThis ? 'shadow-lg' : !isEditingThis ? 'hover:brightness-95 hover:shadow-md' : ''}`}
                                >
                                  {!isEditingThis && <>
                                    <div className="absolute left-0 top-0 w-2 h-full cursor-ew-resize z-30 rounded-l-xl" onMouseDown={(e) => handleMouseDown(e, banner, 'resize-start')} />
                                    <div className="absolute right-0 top-0 w-2 h-full cursor-ew-resize z-30 rounded-r-xl" onMouseDown={(e) => handleMouseDown(e, banner, 'resize-end')} />
                                  </>}
                                  {!isEditingThis && (
                                    <div className="flex items-center w-full h-full px-2 gap-1.5"
                                      onDoubleClick={(e) => startEdit(e, banner)}>
                                      <svg width="7" height="11" viewBox="0 0 7 11" fill="currentColor" className="flex-shrink-0 text-slate-500/50 pointer-events-none">
                                        <circle cx="1.5" cy="1.5" r="1.2"/><circle cx="5.5" cy="1.5" r="1.2"/>
                                        <circle cx="1.5" cy="5.5" r="1.2"/><circle cx="5.5" cy="5.5" r="1.2"/>
                                        <circle cx="1.5" cy="9.5" r="1.2"/><circle cx="5.5" cy="9.5" r="1.2"/>
                                      </svg>
                                      <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden pointer-events-none">
                                        {hasCollision && <AlertCircle size={11} className="text-red-500 animate-pulse flex-shrink-0" />}
                                        {banner.dept && (() => {
                                        const dark = isDark(banner.color);
                                        const bg = dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)';
                                        const txt = dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.5)';
                                        return <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap flex-shrink-0" style={{backgroundColor:bg, color:txt}}>{banner.dept}</span>;
                                      })()}
                                        <span className="text-[11px] font-semibold truncate" style={{color: isDark(banner.color) ? 'rgba(255,255,255,0.95)' : 'rgba(30,41,59,0.9)'}}>{banner.name}</span>
                                      </div>
                                      {banner.memo && (
                                        <div className="flex-shrink-0 pointer-events-none">
                                          <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-sm" />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {!isEditingThis && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/bar:block z-50">
                                      <div className="bg-slate-800 text-white text-[11px] rounded-xl px-3 py-2 shadow-xl leading-relaxed text-center">
                                        <div className="font-bold mb-1">{banner.name}</div>
                                        {banner.memo && <div className="text-slate-300 whitespace-pre-wrap mb-1">{banner.memo}</div>}
                                        <div className="flex items-center justify-center gap-1.5 pt-1.5 border-t border-white/10">
                                          {['#DBEAFE','#EDE9FE','#FCE7F3','#D1FAE5','#FEF3C7','#FFE4E6'].map(c => (
                                            <button key={c}
                                              onMouseDown={e => e.stopPropagation()}
                                              onClick={e => { e.stopPropagation(); updateBanners(prev => prev.map(b => b.id===banner.id?{...b,color:c}:b)); }}
                                              className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-125 flex-shrink-0 ${banner.color===c?'border-white':'border-white/30'}`}
                                              style={{backgroundColor:c}}/>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="w-2 h-2 bg-slate-800 rotate-45 mx-auto -mt-1" />
                                    </div>
                                  )}
                                  {isEditingThis && (
                                    <div className="flex items-center w-full h-full px-1.5 gap-1"
                                      onMouseDown={(e) => e.stopPropagation()}>
                                      <input ref={deptInputRef} className="w-14 h-6 text-[10px] font-bold bg-slate-100 rounded-lg px-1.5 outline-none focus:ring-1 focus:ring-blue-400 text-slate-700 placeholder:text-slate-300 flex-shrink-0"
                                        placeholder="부서" value={editForm.dept}
                                        onChange={(e) => setEditForm(f => ({ ...f, dept: e.target.value }))}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => { if (e.key==='Enter') commitEdit(); if (e.key==='Escape') cancelEdit(); if (e.key==='Tab') { e.preventDefault(); nameInputRef.current?.focus(); } }} />
                                      <input ref={nameInputRef} className="w-32 h-6 text-[11px] font-semibold bg-slate-100 rounded-lg px-1.5 outline-none focus:ring-1 focus:ring-blue-400 text-slate-700 placeholder:text-slate-300"
                                        placeholder="배너명" value={editForm.name}
                                        onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => { if (e.key==='Enter') commitEdit(); if (e.key==='Escape') cancelEdit(); if (e.key==='Tab') { e.preventDefault(); deptInputRef.current?.focus(); } }} />

                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        {['#DBEAFE','#EDE9FE','#FCE7F3','#D1FAE5','#FEF3C7','#FFE4E6'].map(c => (
                                          <button key={c}
                                            onMouseDown={e => e.stopPropagation()}
                                            onClick={e => { e.stopPropagation(); updateBanners(prev => prev.map(b => b.id===banner.id?{...b,color:c}:b)); }}
                                            className={`w-3.5 h-3.5 rounded-full border-2 transition-transform hover:scale-125 flex-shrink-0 ${banner.color===c?'border-slate-500':'border-white shadow-sm'}`}
                                            style={{backgroundColor:c}}/>
                                        ))}
                                      </div>
                                      <button onClick={(e) => { e.stopPropagation(); commitEdit(); }} className="flex-shrink-0 bg-blue-500 hover:bg-blue-600 text-white rounded-lg p-1"><Check size={10} /></button>
                                      <button onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="flex-shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg p-1"><X size={10} /></button>
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
          <div className="px-5 py-3.5 border-b border-slate-100">
            <div className="flex justify-between items-center gap-3">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                  <Layout size={15} className="text-blue-400"/>
                  배너 데이터 상세 설정
                </h2>
                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                  {['전체','진행중','대기','종료'].map(tab => {
                    const count = tab === '전체' ? banners.length : banners.filter(b => getStatus(b.start, b.end) === tab).length;
                    return (
                      <button key={tab} onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${activeTab===tab?'bg-white text-blue-500 shadow-sm':'text-slate-400 hover:text-slate-600'}`}>
                        {tab}
                        <span className={`text-[10px] font-bold px-1 py-0.5 rounded-full ${
                          tab==='진행중' ? 'bg-emerald-100 text-emerald-500' :
                          tab==='대기' ? 'bg-blue-100 text-blue-400' :
                          tab==='종료' ? 'bg-slate-100 text-slate-400' :
                          'bg-slate-200 text-slate-500'
                        }`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input className="pl-7 pr-3 py-1.5 text-xs rounded-xl border border-slate-100 bg-slate-50 outline-none focus:ring-1 focus:ring-blue-300 focus:bg-white transition-all placeholder:text-slate-300 w-48"
                  placeholder="배너명, 부서, 구좌 검색..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}/>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/60 border-b border-slate-100">
                <tr>
                  {[
                    { label: '상태', key: 'status' },
                    { label: '배너 명칭', key: 'name' },
                    { label: '요청 부서', key: 'dept' },
                    { label: '색상', key: null },
                    { label: '노출 구좌', key: 'slot' },
                    { label: '노출 기간 (시작~종료)', key: 'start' },
                    { label: '메모', key: null },
                    { label: '삭제', key: null },
                  ].map(({ label, key }) => (
                    <th key={label}
                      onClick={() => key && setSortBy(k => k === key ? `-${key}` : k === `-${key}` ? null : key)}
                      className={`px-3 py-2.5 text-[12px] font-bold text-slate-500 text-center whitespace-nowrap ${key ? 'cursor-pointer hover:text-blue-500 select-none' : ''}`}>
                      <span className="inline-flex items-center justify-center gap-0.5">
                        {label}
                        {key && (
                          <span className={`text-[10px] ml-0.5 ${sortBy===key||sortBy==='-'+key?'text-blue-500':'opacity-20'}`}>
                            {sortBy === `-${key}` ? '▼' : '▲'}
                          </span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody key={`page-${currentPage}-${activeTab}`} className="divide-y divide-slate-50 text-sm">
                {pagedBanners.map(banner => {
                  const status = getStatus(banner.start, banner.end);
                  const hasCollision = collisionInfo[banner.id];
                  const isBeingEdited = editingId === banner.id;
                  const isHighlighted = highlightedId === banner.id;
                  return (
                    <tr key={banner.id}
                      onClick={() => setHighlightedId(id => id === banner.id ? null : banner.id)}
                      className={`transition-colors text-xs cursor-pointer ${hasCollision ? 'bg-red-50/40' : ''} ${isBeingEdited ? 'bg-blue-50/30' : isHighlighted ? 'bg-yellow-50' : 'hover:bg-slate-50/50'}`}>
                      <td className="px-3 py-1 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap
                            ${status==='진행중' ? 'bg-emerald-50 text-emerald-500' : status==='대기' ? 'bg-blue-50 text-blue-500' : 'bg-slate-100 text-slate-400'}`}>
                            {status}
                          </span>
                          {hasCollision && <span className="text-[9px] font-bold text-red-400 flex items-center gap-0.5 whitespace-nowrap"><AlertCircle size={9} /> 일정 중첩</span>}
                        </div>
                      </td>
                      <td className="px-3 py-1">
                        <input className="bg-transparent border-b border-transparent focus:border-blue-400 outline-none font-semibold text-sm text-slate-700 w-full transition-all py-0.5 min-w-[120px]"
                          value={banner.name}
                          onChange={(e) => updateBanners(prev => prev.map(b => b.id===banner.id ? {...b, name: e.target.value} : b))} />
                      </td>
                      <td className="px-3 py-1 text-center">
                        <input className="bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-100 focus:border-blue-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 text-center transition-all outline-none placeholder:text-slate-300 w-16"
                          value={banner.dept||''} placeholder="부서"
                          onChange={(e) => updateBanners(prev => prev.map(b => b.id===banner.id ? {...b, dept: e.target.value} : b))} />
                      </td>
                      <td className="px-3 py-1 text-center">
                        <ColorPicker
                          value={banner.color || '#DBEAFE'}
                          onChange={(c) => updateBanners(prev => prev.map(b => b.id===banner.id ? {...b, color: c} : b))}
                        />
                      </td>
                      <td className="px-3 py-1">
                        <select className="bg-white border border-slate-100 rounded-lg px-2 py-1 text-xs outline-none font-medium cursor-pointer focus:ring-1 focus:ring-blue-400 w-full"
                          value={banner.slot}
                          onChange={(e) => updateBanners(prev => prev.map(b => b.id===banner.id ? {...b, slot: e.target.value} : b))}>
                          {allSlots.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                          <input type="date"
                            className="border border-slate-100 rounded-lg px-1.5 py-1 text-xs focus:ring-1 focus:ring-blue-400 outline-none flex-shrink-0"
                            value={toDateOnly(banner.start)}
                            onChange={(e) => updateBanners(prev => prev.map(b => b.id===banner.id ? {...b, start:`${e.target.value}T00:00`} : b))} />
                          <span className="text-slate-300 font-bold flex-shrink-0 px-0.5">~</span>
                          <input type="date"
                            className="border border-slate-100 rounded-lg px-1.5 py-1 text-xs focus:ring-1 focus:ring-blue-400 outline-none flex-shrink-0"
                            value={toDateOnly(banner.end)}
                            onChange={(e) => updateBanners(prev => prev.map(b => b.id===banner.id ? {...b, end:`${e.target.value}T23:59`} : b))} />
                        </div>
                      </td>
                      <td className="px-3 py-1">
                        <input className="bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-100 focus:border-blue-300 rounded-lg px-2 py-1 text-xs text-slate-600 w-full transition-all outline-none placeholder:text-slate-300 min-w-[100px]"
                          value={banner.memo||''} placeholder="메모 입력..."
                          onChange={(e) => updateBanners(prev => prev.map(b => b.id===banner.id ? {...b, memo: e.target.value} : b))} />
                      </td>
                      <td className="px-3 py-1 text-center">
                        <button onClick={() => {
                          if (window.confirm(`"${banner.name}" 배너를 삭제할까요?`)) {
                            updateBanners(prev => prev.filter(b => b.id !== banner.id));
                          }
                        }}
                          className="text-slate-200 hover:text-red-400 transition-colors p-1.5 hover:bg-red-50 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pagedBanners.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="text-3xl mb-3">📭</div>
                <p className="text-sm font-semibold text-slate-400">배너가 없어요</p>
                <p className="text-xs text-slate-300 mt-1">상단 '배너 추가' 버튼으로 새 배너를 등록해보세요</p>
              </div>
            )}
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
