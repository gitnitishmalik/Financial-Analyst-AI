"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  TrendingUp, TrendingDown, Upload, MessageSquare, Bell,
  FileText, Trash2, Search, Plus, X, ChevronRight, Activity,
  BarChart2, Zap, Send, RefreshCw, ArrowUpRight, ArrowDownRight,
  LayoutDashboard
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import ReactMarkdown from "react-markdown";
import toast, { Toaster } from "react-hot-toast";
import {
  uploadDocuments, listDocuments, deleteDocument,
  runAnalysis, listAnalyses, getQuote, getHistory,
  searchTicker, getNews, createAlert, listAlerts,
  deleteAlert, streamChat
} from "@/lib/api";

type Tab = "dashboard" | "analyze" | "chat" | "market" | "alerts";
const WATCHLIST = ["AAPL", "GOOGL", "MSFT", "TSLA", "AMZN"];

// ── Chart Types ───────────────────────────────────────────────────────────────
interface ChartConfig {
  title: string;
  subtitle?: string;
  data: { month: string; [key: string]: number | string }[];
  keys: string[];
  colors: string[];
  unit?: string;
}

// ── Auto-detect chart data from agent response ────────────────────────────────
function detectAndParseChart(content: string): ChartConfig | null {
  if (!content || content.length < 20) return null;
  const lower = content.toLowerCase();

  const hasPercent   = lower.includes("%") || lower.includes("percent");
  const hasMonthly   = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|q1|q2|q3|q4|month)\b/i.test(content);
  const hasStocks    = /\b(aapl|tsla|googl|msft|amzn|stock|ticker|share)\b/i.test(content);
  const hasFinancial = /\b(revenue|profit|expense|performance|return|growth|change)\b/i.test(content);

  if (!hasMonthly || (!hasPercent && !hasFinancial && !hasStocks)) return null;

  const monthPatterns = [
    { name: "Jan", regex: /jan(?:uary)?[\s:.\-–]+([+-]?\d+\.?\d*)/i },
    { name: "Feb", regex: /feb(?:ruary)?[\s:.\-–]+([+-]?\d+\.?\d*)/i },
    { name: "Mar", regex: /mar(?:ch)?[\s:.\-–]+([+-]?\d+\.?\d*)/i },
    { name: "Apr", regex: /apr(?:il)?[\s:.\-–]+([+-]?\d+\.?\d*)/i },
    { name: "May", regex: /may[\s:.\-–]+([+-]?\d+\.?\d*)/i },
    { name: "Jun", regex: /jun(?:e)?[\s:.\-–]+([+-]?\d+\.?\d*)/i },
    { name: "Jul", regex: /jul(?:y)?[\s:.\-–]+([+-]?\d+\.?\d*)/i },
    { name: "Aug", regex: /aug(?:ust)?[\s:.\-–]+([+-]?\d+\.?\d*)/i },
    { name: "Sep", regex: /sep(?:tember)?[\s:.\-–]+([+-]?\d+\.?\d*)/i },
    { name: "Oct", regex: /oct(?:ober)?[\s:.\-–]+([+-]?\d+\.?\d*)/i },
    { name: "Nov", regex: /nov(?:ember)?[\s:.\-–]+([+-]?\d+\.?\d*)/i },
    { name: "Dec", regex: /dec(?:ember)?[\s:.\-–]+([+-]?\d+\.?\d*)/i },
    { name: "Q1",  regex: /q1[\s:.\-–]+([+-]?\d+\.?\d*)/i },
    { name: "Q2",  regex: /q2[\s:.\-–]+([+-]?\d+\.?\d*)/i },
    { name: "Q3",  regex: /q3[\s:.\-–]+([+-]?\d+\.?\d*)/i },
    { name: "Q4",  regex: /q4[\s:.\-–]+([+-]?\d+\.?\d*)/i },
  ];

  const extracted: { month: string; value: number }[] = [];
  for (const { name, regex } of monthPatterns) {
    const match = content.match(regex);
    if (match) extracted.push({ month: name, value: parseFloat(match[1]) });
  }

  if (extracted.length < 2) return null;

  const dataKey = hasStocks ? "Change %" : hasFinancial ? "Value" : "Value";
  const data = extracted.map(e => ({ month: e.month, [dataKey]: e.value }));

  return {
    title: hasStocks ? "Monthly % Change" : hasFinancial ? "Financial Performance" : "Monthly Trend",
    subtitle: "Extracted from AI response",
    data,
    keys: [dataKey],
    colors: ["#00e5cc"],
    unit: hasPercent ? "%" : "",
  };
}

// ── Inline Mini Chart Component ───────────────────────────────────────────────
function InlineMiniChart({ config }: { config: ChartConfig }) {
  const [animated, setAnimated] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; month: string; value: number; color: string;
  } | null>(null);

  const W = 480, H = 190;
  const PAD = { top: 18, right: 16, bottom: 34, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const allVals = config.data.flatMap(d => config.keys.map(k => d[k] as number));
  const minVal  = Math.min(...allVals);
  const maxVal  = Math.max(...allVals);
  const range   = maxVal - minVal || 1;
  const padR    = range * 0.2;
  const yMin    = minVal - padR;
  const yMax    = maxVal + padR;

  const xScale = (i: number) =>
    PAD.left + (i / Math.max(config.data.length - 1, 1)) * chartW;
  const yScale = (v: number) =>
    PAD.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;
  const zeroY = Math.min(Math.max(yScale(0), PAD.top), PAD.top + chartH);

  const buildPath = (key: string) =>
    config.data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(d[key] as number).toFixed(1)}`)
      .join(" ");

  const buildArea = (key: string) => {
    const line = config.data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(d[key] as number).toFixed(1)}`)
      .join(" ");
    const last = config.data.length - 1;
    return `${line} L ${xScale(last).toFixed(1)} ${zeroY.toFixed(1)} L ${xScale(0).toFixed(1)} ${zeroY.toFixed(1)} Z`;
  };

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 120);
    return () => clearTimeout(t);
  }, []);

  const yTicks     = 4;
  const yTickVals  = Array.from({ length: yTicks }, (_, i) =>
    yMin + ((yMax - yMin) / (yTicks - 1)) * i
  );
  const latest     = config.data[config.data.length - 1]?.[config.keys[0]] as number;
  const isPositive = latest >= 0;

  return (
    <div
      className="rounded-xl mt-3 p-4 relative"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.7)", fontFamily: "JetBrains Mono, monospace" }}>
            {config.title}
          </p>
          {config.subtitle && (
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              {config.subtitle}
            </p>
          )}
        </div>
        <span
          className="text-xs font-mono font-bold px-2.5 py-1 rounded-full"
          style={{
            background: isPositive ? "rgba(0,229,204,0.12)" : "rgba(244,63,94,0.12)",
            color:      isPositive ? "#00e5cc" : "#f43f5e",
            border:     `1px solid ${isPositive ? "#00e5cc33" : "#f43f5e33"}`,
          }}
        >
          {isPositive ? "▲" : "▼"} {isPositive ? "+" : ""}{latest?.toFixed(2)}{config.unit}
        </span>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ overflow: "visible" }}
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            {config.keys.map((_, ki) => (
              <linearGradient key={ki} id={`ig-${ki}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={config.colors[ki]} stopOpacity="0.22" />
                <stop offset="100%" stopColor={config.colors[ki]} stopOpacity="0"    />
              </linearGradient>
            ))}
            <clipPath id="ic">
              <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} />
            </clipPath>
          </defs>

          {yTickVals.map((v, i) => (
            <g key={i}>
              <line
                x1={PAD.left} x2={PAD.left + chartW}
                y1={yScale(v)} y2={yScale(v)}
                stroke="rgba(255,255,255,0.05)" strokeWidth={1}
              />
              <text
                x={PAD.left - 7} y={yScale(v) + 4}
                textAnchor="end" fontSize={9}
                fill="rgba(255,255,255,0.25)"
                fontFamily="JetBrains Mono,monospace"
              >
                {v >= 0 ? "+" : ""}{v.toFixed(1)}{config.unit}
              </text>
            </g>
          ))}

          {minVal < 0 && maxVal > 0 && (
            <line
              x1={PAD.left} x2={PAD.left + chartW}
              y1={zeroY}    y2={zeroY}
              stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="3 3"
            />
          )}

          {config.data.map((d, i) => (
            <text
              key={i} x={xScale(i)} y={H - 7}
              textAnchor="middle" fontSize={9}
              fill="rgba(255,255,255,0.3)"
              fontFamily="JetBrains Mono,monospace"
            >
              {d.month}
            </text>
          ))}

          <g clipPath="url(#ic)">
            {config.keys.map((key, ki) => (
              <path
                key={`a-${ki}`} d={buildArea(key)}
                fill={`url(#ig-${ki})`}
                style={{ opacity: animated ? 1 : 0, transition: "opacity 0.5s ease" }}
              />
            ))}
            {config.keys.map((key, ki) => (
              <path
                key={`l-${ki}`} d={buildPath(key)}
                fill="none" stroke={config.colors[ki]} strokeWidth={1.8}
                strokeLinecap="round" strokeLinejoin="round"
                style={{
                  strokeDasharray:  animated ? "none" : "800",
                  strokeDashoffset: animated ? 0 : 800,
                  transition: "stroke-dashoffset 0.85s cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            ))}
          </g>

          {config.data.map((d, i) =>
            config.keys.map((key, ki) => (
              <circle
                key={`dot-${i}-${ki}`}
                cx={xScale(i)} cy={yScale(d[key] as number)}
                r={4} fill={config.colors[ki]}
                stroke="#111827" strokeWidth={1.5}
                style={{ cursor: "crosshair", opacity: animated ? 1 : 0, transition: "opacity 0.3s" }}
                onMouseEnter={() =>
                  setTooltip({
                    x: xScale(i), y: yScale(d[key] as number),
                    month: d.month as string,
                    value: d[key] as number,
                    color: config.colors[ki],
                  })
                }
              />
            ))
          )}

          {tooltip && (
            <line
              x1={tooltip.x} x2={tooltip.x}
              y1={PAD.top}   y2={PAD.top + chartH}
              stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="3 3"
            />
          )}
        </svg>

        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl"
            style={{
              left:      `${(tooltip.x / W) * 100}%`,
              top:       `${(tooltip.y / H) * 100}%`,
              transform: "translate(-50%, -130%)",
              background: "#0f172a",
              borderColor: tooltip.color + "55",
              color: "#fff",
              fontFamily: "JetBrains Mono, monospace",
              minWidth: 80,
            }}
          >
            <div style={{ color: tooltip.color }}>{tooltip.month}</div>
            <div className="font-semibold">
              {tooltip.value >= 0 ? "+" : ""}{tooltip.value.toFixed(2)}{config.unit}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-4 mt-1">
        {config.keys.map((key, i) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-px rounded-full" style={{ background: config.colors[i] }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "JetBrains Mono,monospace" }}>
              {key}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [tab, setTab]                   = useState<Tab>("dashboard");
  const [docs, setDocs]                 = useState<any[]>([]);
  const [analyses, setAnalyses]         = useState<any[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [query, setQuery]               = useState("Analyze for investment opportunities and key risks");
  const [analyzing, setAnalyzing]       = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<any>(null);
  const [quotes, setQuotes]             = useState<Record<string, any>>({});
  const [chartTicker, setChartTicker]   = useState("AAPL");
  const [chartData, setChartData]       = useState<any[]>([]);
  const [chartPeriod, setChartPeriod]   = useState("1mo");
  const [searchQ, setSearchQ]           = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [news, setNews]                 = useState<any[]>([]);
  const [alerts, setAlerts]             = useState<any[]>([]);
  const [alertTicker, setAlertTicker]   = useState("");
  const [alertCond, setAlertCond]       = useState("above");
  const [alertVal, setAlertVal]         = useState("");
  const [messages, setMessages]         = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput]       = useState("");
  const [chatLoading, setChatLoading]   = useState(false);
  const chatEndRef                      = useRef<HTMLDivElement>(null);
  const sessionId                       = useRef(`session-${Date.now()}`);

  useEffect(() => { loadDocs(); loadAnalyses(); loadAlerts(); loadWatchlist(); }, []);
  useEffect(() => { if (tab === "market") loadChart(chartTicker, chartPeriod); }, [tab, chartTicker, chartPeriod]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ── Fixed loadDocs — handles both response formats ──────────────────────────
  const loadDocs = async () => {
    try {
      const r = await listDocuments();
      console.log("Docs response:", r.data);
      const documents = r.data.documents ?? r.data ?? [];
      setDocs(Array.isArray(documents) ? documents : []);
    } catch (err) {
      console.error("Load docs error:", err);
    }
  };

  const loadAnalyses  = async () => {
    try {
      const r = await listAnalyses();
      const analyses = r.data.analyses ?? r.data ?? [];
      setAnalyses(Array.isArray(analyses) ? analyses : []);
    } catch {}
  };

  const loadAlerts = async () => {
    try {
      const r = await listAlerts();
      const alerts = r.data.alerts ?? r.data ?? [];
      setAlerts(Array.isArray(alerts) ? alerts : []);
    } catch {}
  };

  const loadWatchlist = async () => {
    const res: Record<string, any> = {};
    await Promise.all(WATCHLIST.map(async t => { try { const r = await getQuote(t); res[t] = r.data; } catch {} }));
    setQuotes(res);
  };

  const loadChart = async (ticker: string, period: string) => {
    try {
      const r  = await getHistory(ticker, period); setChartData(r.data.candles || []);
      const nr = await getNews(ticker); setNews(nr.data.news || []);
    } catch {}
  };

  // ── Fixed onDrop — awaits loadDocs and shows proper errors ─────────────────
  const onDrop = useCallback(async (files: File[]) => {
    const id = toast.loading(`Uploading ${files.length} file(s)...`);
    try {
      const response = await uploadDocuments(files);
      console.log("Upload response:", response.data);
      toast.success("Uploaded!", { id });
      await loadDocs(); // ← await to refresh list immediately
    } catch (err: any) {
      console.error("Upload error:", err?.response?.data || err);
      toast.error(err?.response?.data?.detail || "Upload failed", { id });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "application/pdf": [".pdf"], "text/csv": [".csv"] }
  });

  const handleDelete  = async (id: string) => {
    try { await deleteDocument(id); await loadDocs(); toast.success("Deleted"); } catch {}
  };

  const handleAnalyze = async () => {
    if (!selectedDocs.length) { toast.error("Select at least one document"); return; }
    setAnalyzing(true);
    try {
      const r = await runAnalysis(selectedDocs, query);
      setLastAnalysis(r.data);
      await loadAnalyses();
      toast.success("Analysis complete!");
    } catch { toast.error("Analysis failed"); }
    setAnalyzing(false);
  };

  const handleChat = () => {
    if (!chatInput.trim()) return;
    const msg = chatInput; setChatInput("");
    setMessages(m => [...m, { role: "user", content: msg }]);
    setChatLoading(true); let ai = "";
    setMessages(m => [...m, { role: "assistant", content: "" }]);
    streamChat(msg, selectedDocs, sessionId.current,
      chunk => { ai += chunk; setMessages(m => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: ai }; return c; }); },
      () => setChatLoading(false)
    );
  };

  const handleSearch   = async () => { if (!searchQ) return; try { const r = await searchTicker(searchQ); setSearchResults(r.data.results); } catch {} };
  const handleAddAlert = async () => {
    if (!alertTicker || !alertVal) { toast.error("Fill in all fields"); return; }
    try { await createAlert(alertTicker, alertCond, parseFloat(alertVal)); loadAlerts(); setAlertTicker(""); setAlertVal(""); toast.success("Alert created!"); }
    catch { toast.error("Failed"); }
  };

  const recBadge = (r: string) => r === "BUY" ? "badge-buy" : r === "SELL" ? "badge-sell" : "badge-hold";

  const navItems: { id: Tab; label: string; icon: any }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "analyze",   label: "Analyze",   icon: FileText },
    { id: "chat",      label: "AI Chat",   icon: MessageSquare },
    { id: "market",    label: "Markets",   icon: Activity },
    { id: "alerts",    label: "Alerts",    icon: Bell },
  ];

  const stats = [
    { label: "Documents",     value: docs.length,      icon: FileText,  color: "var(--accent)" },
    { label: "Analyses run",  value: analyses.length,  icon: BarChart2, color: "var(--purple)" },
    { label: "Active alerts", value: alerts.length,    icon: Bell,      color: "var(--warning)" },
    { label: "Watchlist",     value: WATCHLIST.length, icon: Activity,  color: "var(--success)" },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
      <Toaster position="top-right" toastOptions={{
        style: { background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-bright)", fontFamily: "Outfit,sans-serif", fontSize: 13 }
      }} />

      {/* Ticker tape */}
      <div className="border-b overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg-surface)", padding: "5px 0" }}>
        <div className="ticker-wrap">
          <div className="ticker-content gap-8 px-4" style={{ fontSize: 11 }}>
            {[...WATCHLIST, ...WATCHLIST].map((t, i) => {
              const q = quotes[t];
              return (
                <span key={i} className="inline-flex items-center gap-2 pr-8">
                  <span className="font-mono font-semibold" style={{ color: "var(--accent)", letterSpacing: "0.05em" }}>{t}</span>
                  {q?.price ? (
                    <>
                      <span className="font-mono" style={{ color: "var(--text-secondary)" }}>${q.price}</span>
                      <span className={`font-mono font-medium ${q.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {q.change >= 0 ? "+" : ""}{q.change_pct}%
                      </span>
                    </>
                  ) : <span style={{ color: "var(--text-dim)" }}>—</span>}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="border-b px-6 flex items-center justify-between"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)", height: 54 }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent)" }}>
            <TrendingUp size={15} color="#030f12" strokeWidth={2.5} />
          </div>
          <span className="font-display font-semibold text-base" style={{ color: "var(--accent)", letterSpacing: "-0.01em" }}>
            Finance Analyzer
          </span>
        </div>
        <div className="flex items-center gap-2" style={{ fontSize: 12, color: "var(--text-muted)" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: "var(--accent)" }} />
          Live · Demo Mode
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-52 border-r flex flex-col py-5 px-3 shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
          <p className="text-xs font-semibold mb-3 px-2" style={{ color: "var(--text-dim)", letterSpacing: "0.1em" }}>MENU</p>
          <div className="flex flex-col gap-0.5">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all font-medium ${tab === id ? "nav-active" : ""}`}
                style={{ color: tab === id ? "var(--accent)" : "var(--text-muted)", border: "1px solid transparent" }}>
                <Icon size={15} strokeWidth={tab === id ? 2.2 : 1.8} />
                {label}
              </button>
            ))}
          </div>
          <div className="mt-auto pt-4 border-t px-2 space-y-1.5" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-dim)" }}>
              <span>Documents</span>
              <span className="font-mono" style={{ color: "var(--text-muted)" }}>{docs.length}</span>
            </div>
            <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-dim)" }}>
              <span>Analyses</span>
              <span className="font-mono" style={{ color: "var(--text-muted)" }}>{analyses.length}</span>
            </div>
          </div>
        </nav>

        {/* Main */}
        <main className="flex-1 overflow-auto p-6" style={{ background: "var(--bg-primary)" }}>

          {/* ── DASHBOARD ── */}
          {tab === "dashboard" && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h1 className="font-display text-2xl font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Overview</h1>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Monitor your financial intelligence hub</p>
              </div>
              <div className="grid grid-cols-4 gap-3 stagger">
                {stats.map(s => (
                  <div key={s.label} className="matte-card rounded-xl p-4 relative overflow-hidden animate-fade-in card-hover">
                    <div className="stat-card-accent" />
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{s.label}</span>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: `${s.color}15`, border: `1px solid ${s.color}22` }}>
                        <s.icon size={13} color={s.color} />
                      </div>
                    </div>
                    <p className="font-display text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Watchlist */}
              <div className="matte-card rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>WATCHLIST</p>
                  <button onClick={loadWatchlist} className="flex items-center gap-1 btn-ghost rounded-md px-2 py-1" style={{ fontSize: 11 }}>
                    <RefreshCw size={10} /> Refresh
                  </button>
                </div>
                <div className="space-y-1">
                  {WATCHLIST.map(t => {
                    const q = quotes[t]; const up = q?.change >= 0;
                    return (
                      <div key={t} className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                        <span className="font-mono text-sm font-semibold" style={{ color: "var(--accent)" }}>{t}</span>
                        {q?.price ? (
                          <div className="flex items-center gap-3 text-xs">
                            <span className="font-mono" style={{ color: "var(--text-primary)" }}>${q.price}</span>
                            <span className={`flex items-center gap-0.5 font-mono font-medium px-1.5 py-0.5 rounded ${up ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
                              {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                              {up ? "+" : ""}{q.change_pct}%
                            </span>
                          </div>
                        ) : <span className="text-xs" style={{ color: "var(--text-dim)" }}>—</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {analyses.length > 0 && (
                <div className="matte-card rounded-xl p-5 animate-fade-in">
                  <p className="text-xs font-semibold mb-4" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>RECENT ANALYSES</p>
                  <div className="space-y-1">
                    {analyses.slice(0, 5).map(a => (
                      <div key={a.id} className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{a.query}</p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{new Date(a.created_at).toLocaleDateString()}</p>
                        </div>
                        {a.result?.recommendation && (
                          <span className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-lg ml-3 ${recBadge(a.result.recommendation)}`}>
                            {a.result.recommendation}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ANALYZE ── */}
          {tab === "analyze" && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h1 className="font-display text-2xl font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Document Analysis</h1>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Upload and analyze financial documents with AI</p>
              </div>

              <div {...getRootProps()} className="matte-card rounded-xl p-8 text-center cursor-pointer transition-all"
                style={{ borderStyle: "dashed", borderWidth: 2, borderColor: isDragActive ? "rgba(6,182,212,0.6)" : "var(--border)" }}>
                <input {...getInputProps()} />
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)" }}>
                  <Upload size={18} style={{ color: "var(--accent)" }} />
                </div>
                <p className="font-medium" style={{ color: "var(--text-primary)" }}>{isDragActive ? "Drop to upload" : "Drop PDFs or CSVs here"}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Up to 50MB · PDF, CSV</p>
              </div>

              {docs.length > 0 && (
                <div className="matte-card rounded-xl p-5">
                  <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>SELECT DOCUMENTS</p>
                  <div className="space-y-1.5">
                    {docs.map(d => (
                      <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border"
                        style={{ borderColor: selectedDocs.includes(d.id) ? "rgba(6,182,212,0.4)" : "var(--border)", background: selectedDocs.includes(d.id) ? "rgba(6,182,212,0.05)" : "transparent" }}
                        onClick={() => setSelectedDocs(s => s.includes(d.id) ? s.filter(x => x !== d.id) : [...s, d.id])}>
                        <div className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all"
                          style={{ borderColor: selectedDocs.includes(d.id) ? "var(--accent)" : "rgba(255,255,255,0.15)", background: selectedDocs.includes(d.id) ? "var(--accent)" : "transparent" }}>
                          {selectedDocs.includes(d.id) && <span style={{ color: "#030f12", fontSize: 10, fontWeight: 700 }}>✓</span>}
                        </div>
                        <FileText size={13} style={{ color: "var(--accent)" }} />
                        <span className="flex-1 text-sm truncate" style={{ color: "var(--text-primary)" }}>{d.name}</span>
                        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{(d.size / 1024).toFixed(0)}KB</span>
                        <button onClick={e => { e.stopPropagation(); handleDelete(d.id); }}
                          className="p-1.5 rounded transition-all opacity-30 hover:opacity-100 hover:text-red-400">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="matte-card rounded-xl p-5 space-y-3">
                <p className="text-xs font-semibold" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>ANALYSIS QUERY</p>
                <textarea value={query} onChange={e => setQuery(e.target.value)} rows={3}
                  className="w-full text-sm rounded-lg p-3 resize-none input-base" style={{ lineHeight: 1.6 }} />
                <button onClick={handleAnalyze} disabled={analyzing || !selectedDocs.length}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm btn-accent">
                  {analyzing ? <><RefreshCw size={14} className="animate-spin" /> Analyzing…</> : <><Zap size={14} /> Run Analysis</>}
                </button>
              </div>

              {lastAnalysis && (
                <div className="matte-card rounded-xl p-6 space-y-5 animate-slide-up"
                  style={{ borderColor: "rgba(6,182,212,0.25)" }}>
                  <div className="flex items-center justify-between">
                    <p className="font-display font-semibold text-lg" style={{ color: "var(--text-primary)" }}>Analysis Result</p>
                    <span className={`text-xs font-mono font-semibold px-3 py-1.5 rounded-lg ${recBadge(lastAnalysis.recommendation)}`}>
                      {lastAnalysis.recommendation}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Confidence",   val: `${lastAnalysis.confidence_pct}%`, color: "var(--accent)" },
                      { label: "Risk Score",   val: `${lastAnalysis.risk_score}/10`,   color: lastAnalysis.risk_score >= 7 ? "var(--danger)" : lastAnalysis.risk_score >= 4 ? "var(--warning)" : "var(--success)" },
                      { label: "Price Target", val: lastAnalysis.price_target ? `$${lastAnalysis.price_target}` : "N/A", color: "var(--text-primary)" },
                    ].map(m => (
                      <div key={m.label} className="matte-elevated rounded-lg p-3.5">
                        <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>{m.label}</p>
                        <p className="font-display text-xl font-semibold" style={{ color: m.color }}>{m.val}</p>
                      </div>
                    ))}
                  </div>
                  {lastAnalysis.reasons?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>KEY REASONS</p>
                      <ul className="space-y-2">
                        {lastAnalysis.reasons.map((r: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                            <ChevronRight size={13} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {lastAnalysis.summary && <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{lastAnalysis.summary}</p>}
                </div>
              )}
            </div>
          )}

          {/* ── CHAT ── */}
          {tab === "chat" && (
            <div className="flex flex-col animate-fade-in" style={{ height: "calc(100vh - 158px)" }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>AI Chat</h1>
                  <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Ask anything about your documents or markets</p>
                </div>
                {selectedDocs.length > 0 && (
                  <span className="text-xs px-3 py-1.5 rounded-lg font-medium badge-hold">{selectedDocs.length} doc(s) loaded</span>
                )}
              </div>

              <div className="matte-card rounded-xl flex flex-col overflow-hidden flex-1">
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                        <MessageSquare size={20} style={{ color: "var(--text-muted)" }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No messages yet</p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                        Try: "Show TSLA monthly % change" to see charts
                      </p>
                    </div>
                  )}

                  {messages.map((m, i) => {
                    const chartConfig = m.role === "assistant" && m.content.length > 30
                      ? detectAndParseChart(m.content)
                      : null;

                    return (
                      <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className="max-w-[78%] rounded-xl px-4 py-3 text-sm"
                          style={{
                            background:  m.role === "user" ? "rgba(6,182,212,0.08)" : "var(--bg-elevated)",
                            border:      m.role === "user" ? "1px solid rgba(6,182,212,0.2)" : "1px solid var(--border)",
                            color:       m.role === "user" ? "var(--text-primary)" : "var(--text-secondary)",
                            lineHeight:  1.65,
                          }}
                        >
                          {m.role === "assistant" ? (
                            <>
                              <ReactMarkdown className="prose prose-sm prose-invert max-w-none">
                                {m.content || "▋"}
                              </ReactMarkdown>
                              {chartConfig && <InlineMiniChart config={chartConfig} />}
                            </>
                          ) : (
                            m.content
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                <div className="border-t p-3 flex gap-2" style={{ borderColor: "var(--border)" }}>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleChat()}
                    placeholder="Ask about revenue trends, monthly % change, risks…"
                    className="flex-1 text-sm rounded-lg px-4 py-2.5 input-base"
                  />
                  <button
                    onClick={handleChat}
                    disabled={chatLoading || !chatInput.trim()}
                    className="px-4 py-2.5 rounded-lg btn-accent disabled:opacity-30"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── MARKETS ── */}
          {tab === "market" && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h1 className="font-display text-2xl font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Markets</h1>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Real-time quotes and charts</p>
              </div>

              <div className="matte-card rounded-xl p-3 flex gap-2">
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  placeholder="Search ticker (e.g. NVDA, Tesla)"
                  className="flex-1 text-sm rounded-lg px-4 py-2.5 input-base" />
                <button onClick={handleSearch} className="px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 btn-accent">
                  <Search size={14} /> Search
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="matte-card rounded-xl p-2 space-y-0.5">
                  {searchResults.map(r => (
                    <button key={r.ticker} onClick={() => { setChartTicker(r.ticker); setSearchResults([]); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-left"
                      onMouseOver={e => (e.currentTarget.style.background = "var(--bg-elevated)")}
                      onMouseOut={e => (e.currentTarget.style.background = "transparent")}
                      style={{ background: "transparent" }}>
                      <span className="font-mono font-semibold text-sm" style={{ color: "var(--accent)" }}>{r.ticker}</span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{r.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="matte-card rounded-xl p-5">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <span className="font-display font-bold text-xl" style={{ color: "var(--accent)" }}>{chartTicker}</span>
                    {quotes[chartTicker] && (
                      <span className="font-mono font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
                        ${quotes[chartTicker]?.price}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                    {["1w", "1mo", "3mo", "1y"].map(p => (
                      <button key={p} onClick={() => setChartPeriod(p)}
                        className="px-3 py-1 text-xs rounded-md font-medium transition-all"
                        style={{
                          background: chartPeriod === p ? "rgba(6,182,212,0.14)" : "transparent",
                          color:      chartPeriod === p ? "var(--accent)" : "var(--text-muted)",
                          border:     chartPeriod === p ? "1px solid rgba(6,182,212,0.3)" : "1px solid transparent",
                        }}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <defs>
                      <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#06b6d4" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-dim)", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-dim)", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-bright)", borderRadius: 8, fontSize: 11, fontFamily: "JetBrains Mono" }}
                      labelStyle={{ color: "var(--text-muted)" }}
                      itemStyle={{ color: "var(--accent)" }}
                    />
                    <Area type="monotone" dataKey="close" stroke="#06b6d4" strokeWidth={1.8} fill="url(#cyanGrad)" dot={false}
                      activeDot={{ r: 3, fill: "#06b6d4", strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex gap-2 flex-wrap">
                {WATCHLIST.map(t => {
                  const q = quotes[t]; const up = q?.change >= 0;
                  return (
                    <button key={t} onClick={() => setChartTicker(t)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all border"
                      style={{
                        background:  chartTicker === t ? "rgba(6,182,212,0.08)" : "var(--bg-surface)",
                        borderColor: chartTicker === t ? "rgba(6,182,212,0.35)" : "var(--border)",
                        color:       chartTicker === t ? "var(--accent)" : "var(--text-secondary)",
                      }}>
                      {t}
                      {q?.price && <span className={`ml-1 ${up ? "text-emerald-400" : "text-red-400"}`}>{up ? "+" : ""}{q.change_pct}%</span>}
                    </button>
                  );
                })}
              </div>

              {news.length > 0 && (
                <div className="matte-card rounded-xl p-5">
                  <p className="text-xs font-semibold mb-4" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>LATEST NEWS — {chartTicker}</p>
                  <div className="space-y-1.5">
                    {news.map((n, i) => (
                      <a key={i} href={n.link} target="_blank" rel="noreferrer"
                        className="flex items-start justify-between gap-4 p-3 rounded-lg transition-all border card-hover"
                        style={{ borderColor: "var(--border)" }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{n.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{n.publisher} · {n.published}</p>
                        </div>
                        <ArrowUpRight size={13} className="shrink-0 mt-0.5" style={{ color: "var(--text-dim)" }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ALERTS ── */}
          {tab === "alerts" && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h1 className="font-display text-2xl font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Price Alerts</h1>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Get notified on price movements</p>
              </div>

              <div className="matte-card rounded-xl p-5 space-y-4">
                <p className="text-xs font-semibold" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>CREATE ALERT</p>
                <div className="grid grid-cols-3 gap-3">
                  <input value={alertTicker} onChange={e => setAlertTicker(e.target.value.toUpperCase())}
                    placeholder="Ticker (e.g. AAPL)" className="text-sm rounded-lg px-3 py-2.5 input-base font-mono" />
                  <select value={alertCond} onChange={e => setAlertCond(e.target.value)}
                    className="text-sm rounded-lg px-3 py-2.5 input-base">
                    <option value="above">Price above</option>
                    <option value="below">Price below</option>
                  </select>
                  <input value={alertVal} onChange={e => setAlertVal(e.target.value)}
                    type="number" placeholder="Threshold ($)" className="text-sm rounded-lg px-3 py-2.5 input-base font-mono" />
                </div>
                <button onClick={handleAddAlert} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm btn-accent">
                  <Plus size={14} /> Add Alert
                </button>
              </div>

              {alerts.length > 0 ? (
                <div className="matte-card rounded-xl p-5">
                  <p className="text-xs font-semibold mb-4" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>ACTIVE ALERTS</p>
                  <div className="space-y-2">
                    {alerts.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-3.5 rounded-lg border card-hover"
                        style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
                        <div className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
                          <span className="font-mono font-semibold text-sm" style={{ color: "var(--accent)" }}>{a.ticker}</span>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {a.condition} <span className="font-mono" style={{ color: "var(--text-secondary)" }}>${a.threshold}</span>
                          </span>
                        </div>
                        <button onClick={async () => { await deleteAlert(a.id); loadAlerts(); }}
                          className="p-1.5 rounded opacity-30 hover:opacity-100 hover:text-red-400 transition-all">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="matte-card rounded-xl p-16 text-center">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                    <Bell size={20} style={{ color: "var(--text-muted)" }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No alerts yet</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Create one above to get started</p>
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}