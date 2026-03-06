```jsx
// App.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Save,
  Pencil,
  Check,
  X,
} from "lucide-react";

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzoHeSt4DxT1m1Oqwiromcldeso49DHDJCtH_JVzVMuKJ2b5Q1GEMig4R_vmvVL-nUMaQ/exec";

const DEFAULT_SLOTS = [
  "로고 배너",
  "레이어",
  "헤더배너",
  "강조 no.1 (#1)",
  "강조 no.1 (#2)",
  "강조 no.1 (#3)",
  "강조 no.3 (랜덤)",
];

const normalizeDateTime = (str) => {
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str)) return str;
  if (str.length >= 16) return str.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return `${str}T00:00`;
  return str;
};

const toDateOnly = (str) => (!str ? "" : str.slice(0, 10));

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showOnlyVisible, setShowOnlyVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("전체");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const [allSlots, setAllSlots] = useState(DEFAULT_SLOTS);
  const [banners, setBanners] = useState([]);

  const [visibleSlots, setVisibleSlots] = useState(
    DEFAULT_SLOTS.reduce((acc, s) => ({ ...acc, [s]: true }), {})
  );

  const isFirstLoad = useRef(true);
  const slotRefs = useRef({});

  useEffect(() => {
    if (isFirstLoad.current) return;
    setHasUnsaved(true);
  }, [banners]);

  useEffect(() => {
    const fn = (e) => {
      if (!hasUnsaved) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [hasUnsaved]);

  /* ------------------- 데이터 로딩 ------------------- */

  useEffect(() => {
    fetch(SCRIPT_URL)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.length > 0) {
          setBanners(
            data.map((b) => ({
              ...b,
              id: String(b.id),
              start: normalizeDateTime(b.start),
              end: normalizeDateTime(b.end),
            }))
          );
        }

        setLoading(false);
        setTimeout(() => {
          isFirstLoad.current = false;
        }, 0);
      });
  }, []);

  /* ------------------- 충돌 감지 ------------------- */

  const collisionInfo = useMemo(() => {
    const result = {};

    banners.forEach((b1) => {
      const s1 = new Date(b1.start).getTime();
      const e1 = new Date(b1.end).getTime();

      result[b1.id] = banners.some((b2) => {
        if (b1.id === b2.id || b1.slot !== b2.slot) return false;

        const s2 = new Date(b2.start).getTime();
        const e2 = new Date(b2.end).getTime();

        return s1 <= e2 && s2 <= e1;
      });
    });

    return result;
  }, [banners]);

  /* ------------------- 날짜 관련 ------------------- */

  const formatDateOnly = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const getStatus = (s, e) => {
    const now = new Date();
    if (new Date(e) < now) return "종료";
    if (new Date(s) > now) return "대기";
    return "진행중";
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

  const isToday = (date) => {
    const n = new Date();
    return (
      date.getFullYear() === n.getFullYear() &&
      date.getMonth() === n.getMonth() &&
      date.getDate() === n.getDate()
    );
  };

  const displaySlots = showOnlyVisible
    ? allSlots.filter((s) => visibleSlots[s])
    : allSlots;

  const filteredBanners = banners.filter(
    (b) => activeTab === "전체" || getStatus(b.start, b.end) === activeTab
  );

  /* ------------------- 저장 ------------------- */

  const handleSave = () => {
    setSaving(true);

    fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "save", data: banners }),
    }).finally(() => {
      setSaving(false);
      setHasUnsaved(false);
    });
  };

  /* ------------------- 새 배너 ------------------- */

  const makeDefault = (addDays, endOfDay) => {
    const d = new Date();
    d.setDate(d.getDate() + addDays);

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}T${
      endOfDay ? "23:59" : "00:00"
    }`;
  };

  const updateBanner = (id, patch) =>
    setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">불러오는 중...</p>
        </div>
      </div>
    );
  }

  /* ------------------- UI ------------------- */

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-700 font-sans">

      {/* 헤더 */}

      <div className="flex items-center justify-between px-6 py-3 bg-white border-b">

        <h1 className="font-bold text-slate-700 flex items-center gap-2">
          🍦 배너 관리
        </h1>

        <div className="flex items-center gap-2">

          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-1.5 rounded-full text-xs font-bold"
          >
            <Save size={13} />
            저장
          </button>

          <button
            onClick={() =>
              setBanners((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  name: "새 배너",
                  slot: allSlots[0],
                  start: makeDefault(0, false),
                  end: makeDefault(4, true),
                  dept: "",
                  color: "#DBEAFE",
                  memo: "",
                },
              ])
            }
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-1.5 rounded-full text-xs font-bold"
          >
            <Plus size={13} />
            배너 추가
          </button>
        </div>
      </div>

      {/* 하단 테이블 */}

      <div className="p-6">

        <table className="w-full text-sm">

          <thead className="text-slate-400 text-xs">

            <tr>
              <th>상태</th>
              <th>배너 명칭</th>
              <th>담당 부서</th>
              <th>색상</th>
              <th>노출 구좌</th>
              <th>노출 기간</th>
              <th>메모</th>
              <th>삭제</th>
            </tr>

          </thead>

          <tbody>

            {filteredBanners.map((banner) => {

              const status = getStatus(banner.start, banner.end);

              return (
                <tr key={banner.id}>

                  <td>{status}</td>

                  <td>
                    <input
                      value={banner.name}
                      onChange={(e) =>
                        updateBanner(banner.id, { name: e.target.value })
                      }
                    />
                  </td>

                  <td>
                    <input
                      value={banner.dept || ""}
                      onChange={(e) =>
                        updateBanner(banner.id, { dept: e.target.value })
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="color"
                      value={banner.color}
                      onChange={(e) =>
                        updateBanner(banner.id, { color: e.target.value })
                      }
                    />
                  </td>

                  <td>{banner.slot}</td>

                  <td>
                    {toDateOnly(banner.start)} ~ {toDateOnly(banner.end)}
                  </td>

                  <td>
                    <input
                      value={banner.memo || ""}
                      onChange={(e) =>
                        updateBanner(banner.id, { memo: e.target.value })
                      }
                    />
                  </td>

                  <td>
                    <button
                      onClick={() =>
                        setBanners((prev) =>
                          prev.filter((b) => b.id !== banner.id)
                        )
                      }
                    >
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
  );
}
```
