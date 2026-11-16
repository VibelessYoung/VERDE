"use client";

import JSZip from "jszip";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  CloudDownload,
  Github,
  Info,
  Layers3,
  MousePointer2,
  Paintbrush2,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  SquarePen,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  countCells,
  createDemoGrid,
  DEFAULT_COMMITS_PER_LEVEL,
  emptyGrid,
  estimateCommits,
  formatDate,
  getMonthLabels,
  isValidGrid,
  makeDateRange,
  PALETTE,
  type CommitsPerLevel,
  type ContributionGrid,
  type ContributionPlan,
  WEEKS,
} from "@/lib/plan";
import { buildExportReadme, buildGithubWorkflow, buildRunnerScript } from "@/lib/export-bundle";

const STORAGE_KEY = "verde-contribution-art-v1";
const INITIAL_RANGE = makeDateRange();
const WEEKDAY_LABELS = ["", "دوشنبه", "", "چهارشنبه", "", "جمعه", ""];

function cloneGrid(grid: ContributionGrid): ContributionGrid {
  return grid.map((week) => [...week]);
}

function getDatesFromStart(startDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  return Array.from({ length: WEEKS }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + week * 7 + day);
      return date.toISOString().slice(0, 10);
    }),
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function ContributionStudio() {
  const [grid, setGrid] = useState<ContributionGrid>(() => emptyGrid());
  const [startDate, setStartDate] = useState(INITIAL_RANGE.startDate);
  const [commitsPerLevel, setCommitsPerLevel] = useState<CommitsPerLevel>([...DEFAULT_COMMITS_PER_LEVEL]);
  const [activeLevel, setActiveLevel] = useState(3);
  const [authorName, setAuthorName] = useState("Your GitHub name");
  const [authorEmail, setAuthorEmail] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [hoveredCell, setHoveredCell] = useState<{ date: string; level: number } | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [isPainting, setIsPainting] = useState(false);
  const [mobileGuideOpen, setMobileGuideOpen] = useState(false);

  const paintingRef = useRef(false);
  const historyRef = useRef<ContributionGrid[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);

  const dates = useMemo(() => getDatesFromStart(startDate), [startDate]);
  const monthLabels = useMemo(() => getMonthLabels(dates), [dates]);
  const stats = useMemo(() => countCells(grid), [grid]);
  const totalCommits = useMemo(() => estimateCommits(grid, commitsPerLevel), [grid, commitsPerLevel]);
  const totalDays = WEEKS * 7;
  const isLargePlan = totalCommits > 3000;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          grid?: unknown;
          startDate?: string;
          commitsPerLevel?: unknown;
          activeLevel?: number;
          authorName?: string;
          authorEmail?: string;
        };
        if (isValidGrid(parsed.grid)) setGrid(parsed.grid);
        if (typeof parsed.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.startDate)) {
          setStartDate(parsed.startDate);
        }
        if (
          Array.isArray(parsed.commitsPerLevel) &&
          parsed.commitsPerLevel.length === 5 &&
          parsed.commitsPerLevel.every((value, index) => Number.isInteger(value) && Number(value) >= (index === 0 ? 0 : 1) && Number(value) <= 20) &&
          parsed.commitsPerLevel[0] === 0
        ) {
          setCommitsPerLevel(parsed.commitsPerLevel as CommitsPerLevel);
        }
        if (typeof parsed.activeLevel === "number" && Number.isInteger(parsed.activeLevel) && parsed.activeLevel >= 0 && parsed.activeLevel <= 4) {
          setActiveLevel(parsed.activeLevel);
        }
        if (typeof parsed.authorName === "string") setAuthorName(parsed.authorName);
        if (typeof parsed.authorEmail === "string") setAuthorEmail(parsed.authorEmail);
      }
    } catch {
      setImportMessage("ذخیره محلی قابل خواندن نبود؛ با یک بوم خالی شروع کردیم.");
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ grid, startDate, commitsPerLevel, activeLevel, authorName, authorEmail }),
      );
    } catch {
      // The editor remains usable when browser storage is unavailable or full.
    }
  }, [grid, startDate, commitsPerLevel, activeLevel, authorName, authorEmail, isLoaded]);

  const saveHistory = useCallback((current: ContributionGrid) => {
    historyRef.current = [...historyRef.current.slice(-79), cloneGrid(current)];
  }, []);

  const paintCell = useCallback((weekIndex: number, dayIndex: number, level: number) => {
    setGrid((current) => {
      if (current[weekIndex]?.[dayIndex] === level) return current;
      const next = current.map((week, index) => (index === weekIndex ? [...week] : week));
      next[weekIndex][dayIndex] = level;
      return next;
    });
  }, []);

  const startPainting = (weekIndex: number, dayIndex: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    saveHistory(grid);
    paintingRef.current = true;
    setIsPainting(true);
    setHoveredCell({ date: dates[weekIndex][dayIndex], level: activeLevel });
    paintCell(weekIndex, dayIndex, activeLevel);
  };

  const continuePainting = (weekIndex: number, dayIndex: number) => {
    if (paintingRef.current) paintCell(weekIndex, dayIndex, activeLevel);
  };

  const stopPainting = () => {
    paintingRef.current = false;
    setIsPainting(false);
  };

  const undo = () => {
    const previous = historyRef.current.pop();
    if (previous) setGrid(previous);
  };

  const clearCanvas = () => {
    if (!window.confirm("همه خانه‌های طرح پاک شوند؟")) return;
    saveHistory(grid);
    setGrid(emptyGrid());
    setImportMessage("بوم پاک شد. می‌توانی از نو طراحی کنی.");
  };

  const loadDemo = () => {
    saveHistory(grid);
    setGrid(createDemoGrid());
    setImportMessage("طرح نمونه موج نئونی بارگذاری شد؛ حالا می‌توانی آن را ویرایش کنی.");
  };

  const updateCommitCount = (level: number, rawValue: string) => {
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 1 || value > 20) return;
    setCommitsPerLevel((current) => {
      const next = [...current] as CommitsPerLevel;
      next[level] = value;
      return next;
    });
  };

  const importPlan = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const candidate = parsed as Partial<ContributionPlan>;
      if (!isValidGrid(candidate.cells)) throw new Error("ساختار خانه‌ها باید ۵۳ ستون و ۷ ردیف داشته باشد.");
      saveHistory(grid);
      setGrid(candidate.cells);
      if (typeof candidate.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(candidate.startDate)) {
        setStartDate(candidate.startDate);
      }
      if (
        Array.isArray(candidate.commitsPerLevel) &&
        candidate.commitsPerLevel.length === 5 &&
        candidate.commitsPerLevel[0] === 0 &&
        candidate.commitsPerLevel.every((value, index) => Number.isInteger(value) && Number(value) >= (index === 0 ? 0 : 1) && Number(value) <= 20)
      ) {
        setCommitsPerLevel(candidate.commitsPerLevel as CommitsPerLevel);
      }
      if (typeof candidate.authorName === "string") setAuthorName(candidate.authorName);
      if (typeof candidate.authorEmail === "string") setAuthorEmail(candidate.authorEmail);
      setImportMessage(`طرح «${file.name}» با موفقیت بارگذاری شد.`);
    } catch (error) {
      setImportMessage(error instanceof Error ? `بارگذاری ناموفق بود: ${error.message}` : "فایل JSON معتبر نیست.");
    } finally {
      event.target.value = "";
    }
  };

  const downloadJson = () => {
    const plan: ContributionPlan = {
      schemaVersion: 1,
      product: "contribution-art-studio",
      createdAt: new Date().toISOString(),
      startDate,
      weeks: 53,
      daysPerWeek: 7,
      cells: grid,
      commitsPerLevel,
      authorName: authorName.trim() || "GitHub contributor",
      authorEmail: authorEmail.trim(),
      timezone: "UTC",
    };
    downloadBlob(new Blob([JSON.stringify(plan, null, 2)], { type: "application/json;charset=utf-8" }), "contribution-plan.json");
  };

  const exportPackage = async () => {
    setExportError("");
    if (!stats.active) {
      setExportError("اول حداقل یک خانه را رنگ کن تا طرحی برای خروجی وجود داشته باشد.");
      return;
    }
    if (!isEmail(authorEmail)) {
      setExportError("ایمیل معتبر و تأییدشده‌ی متصل به GitHub را وارد کن.");
      return;
    }
    if (authorName.trim().length < 2) {
      setExportError("نام نویسنده باید حداقل دو حرف داشته باشد.");
      return;
    }
    if (totalCommits > 5000) {
      setExportError("این طرح بیش از ۵۰۰۰ کامیت برآورد می‌کند. برای جلوگیری از اجرای سنگین، تعداد کامیت سطوح را کم کن.");
      return;
    }

    setIsExporting(true);
    try {
      const plan: ContributionPlan = {
        schemaVersion: 1,
        product: "contribution-art-studio",
        createdAt: new Date().toISOString(),
        startDate,
        weeks: 53,
        daysPerWeek: 7,
        cells: grid,
        commitsPerLevel,
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim(),
        timezone: "UTC",
      };
      const zip = new JSZip();
      zip.file("contribution-plan.json", JSON.stringify(plan, null, 2));
      zip.file(".github/workflows/contribution-art.yml", buildGithubWorkflow());
      zip.file("scripts/apply-contribution-plan.mjs", buildRunnerScript());
      zip.file("README-CONTRIBUTION-ART.md", buildExportReadme(plan, totalCommits));
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      downloadBlob(blob, "github-contribution-art.zip");
      setIsExportOpen(false);
      setImportMessage("پکیج آماده شد. فایل ZIP را در ریپوی مستقل GitHub خودت نصب کن.");
    } catch {
      setExportError("ساخت ZIP ناموفق بود. صفحه را تازه‌سازی کن و دوباره امتحان کن.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportPlanAsJson = () => {
    if (!stats.active) {
      setImportMessage("برای خروجی JSON ابتدا حداقل یک خانه را رنگ کن.");
      return;
    }
    downloadJson();
    setImportMessage("فایل JSON طرح دانلود شد.");
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="app-shell" onPointerUp={stopPainting} onPointerCancel={stopPainting}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <a className="brand" href="#top" aria-label="Verde home">
          <span className="brand-mark"><Layers3 size={19} strokeWidth={2.1} /></span>
          <span className="brand-name">VERDE<span className="brand-dot">.</span></span>
          <span className="brand-divider" />
          <span className="brand-subtitle">CONTRIBUTION ART STUDIO</span>
        </a>
        <div className="topbar-right">
          <span className="local-save"><span className="save-dot" /> ذخیره خودکار فعال</span>
          <a className="github-link" href="https://github.com" target="_blank" rel="noreferrer">
            <Github size={16} /> GitHub <ArrowUpRight size={13} />
          </a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> PIXEL ART MEETS YOUR GITHUB <Sparkles size={13} /></div>
          <h1>گراف فعالیتت،<br /><span>بوم طراحی توئه.</span></h1>
          <p className="hero-description">
            با خانه‌های گراف گیت‌هاب نقاشی کن، رنگ‌ها را تنظیم کن و یک اتوماسیون واقعی بساز که طرح را با کامیت‌های روزانه روی پروفایلت پیاده کند.
          </p>
          <div className="hero-points">
            <span><Check size={14} /> ویرایش ۵۳ هفته‌ای</span>
            <span><Check size={14} /> خروجی GitHub Actions</span>
            <span><Check size={14} /> بدون نیاز به PAT</span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit orbit-a" />
          <div className="art-orbit orbit-b" />
          <div className="art-core"><span>V</span></div>
          <div className="art-spark spark-a" />
          <div className="art-spark spark-b" />
          <div className="art-caption">PAINT YOUR<br />ACTIVITY</div>
          <div className="art-grid">
            {Array.from({ length: 70 }, (_, index) => {
              const value = ((index * 7 + Math.floor(index / 7) * 3) % 11);
              const level = value > 7 ? 4 : value > 5 ? 3 : value > 3 ? 2 : value > 1 ? 1 : 0;
              return <span key={index} style={{ background: PALETTE[level], opacity: level === 0 ? 0.7 : 1 }} />;
            })}
          </div>
        </div>
      </section>

      <section className="workspace-section" aria-labelledby="editor-title">
        <div className="section-heading">
          <div>
            <div className="section-kicker">THE CANVAS <span>01 / 03</span></div>
            <h2 id="editor-title">استودیوی طراحی</h2>
            <p>هر خانه یک روز است؛ قلم را انتخاب کن و روی تقویم بکش.</p>
          </div>
          <div className="section-heading-actions">
            <button className="button button-ghost" onClick={() => importInputRef.current?.click()}>
              <Upload size={16} /> بارگذاری طرح
            </button>
            <input ref={importInputRef} type="file" accept=".json,application/json" className="visually-hidden" onChange={importPlan} />
            <button className="button button-primary" onClick={() => { setExportError(""); setIsExportOpen(true); }}>
              <CloudDownload size={16} /> خروجی برای GitHub <ArrowLeft size={15} />
            </button>
          </div>
        </div>

        <div className="studio-card">
          <div className="studio-card-top">
            <div className="canvas-title-wrap">
              <div className="canvas-icon"><Activity size={18} /></div>
              <div>
                <h3>Contribution calendar</h3>
                <span>نمای ۵۳ هفته‌ای · {formatDate(dates[0][0])} تا {formatDate(dates[52][6])}</span>
              </div>
            </div>
            <div className="canvas-actions">
              <button className="icon-button" onClick={undo} disabled={historyRef.current.length === 0} title="واگرد" aria-label="واگرد"><RotateCcw size={16} /></button>
              <button className="icon-button" onClick={loadDemo} title="طرح نمونه" aria-label="طرح نمونه"><Sparkles size={16} /></button>
              <button className="icon-button danger-icon" onClick={clearCanvas} title="پاک کردن بوم" aria-label="پاک کردن بوم"><Trash2 size={16} /></button>
            </div>
          </div>

          <div className="stats-strip">
            <div className="stat-item">
              <span className="stat-label">روزهای رنگ‌شده</span>
              <strong>{stats.active.toLocaleString("fa-IR")} <small>/ {totalDays.toLocaleString("fa-IR")}</small></strong>
            </div>
            <div className="stat-item">
              <span className="stat-label">کامیت تخمینی</span>
              <strong>{totalCommits.toLocaleString("fa-IR")}</strong>
            </div>
            <div className="stat-item stat-levels">
              <span className="stat-label">توزیع شدت</span>
              <div className="mini-levels">
                {[1, 2, 3, 4].map((level) => <span key={level} style={{ background: PALETTE[level] }} title={`سطح ${level}: ${stats.levels[level]} روز`} />)}
              </div>
            </div>
            <div className="stat-item stat-save">
              <span className="save-check"><Save size={13} /> ذخیره در مرورگر</span>
            </div>
          </div>

          <div className="chart-area" onPointerLeave={stopPainting}>
            <div className="chart-scroll" dir="ltr">
              <div className="chart-layout">
                <div className="weekday-labels">
                  {WEEKDAY_LABELS.map((label, index) => <span key={index}>{label}</span>)}
                </div>
                <div className="chart-main">
                  <div className="month-labels">
                    {monthLabels.map((month) => <span key={`${month.week}-${month.label}`} style={{ gridColumnStart: month.week + 1 }}>{month.label}</span>)}
                  </div>
                  <div className={`contribution-grid ${isPainting ? "is-painting" : ""}`}>
                    {grid.map((week, weekIndex) => (
                      <div className="contribution-week" key={weekIndex}>
                        {week.map((level, dayIndex) => {
                          const date = dates[weekIndex][dayIndex];
                          const isCurrentDay = date === today;
                          return (
                            <button
                              key={date}
                              type="button"
                              className={`contribution-cell ${isCurrentDay ? "is-today" : ""}`}
                              style={{ backgroundColor: PALETTE[level] }}
                              data-level={level}
                              title={`${formatDate(date)} · سطح ${level} · ${commitsPerLevel[level]} کامیت هدف`}
                              aria-label={`${formatDate(date)}، سطح ${level}`}
                              onPointerDown={(event) => startPainting(weekIndex, dayIndex, event)}
                              onPointerEnter={() => {
                                setHoveredCell({ date, level: paintingRef.current ? activeLevel : grid[weekIndex][dayIndex] });
                                continuePainting(weekIndex, dayIndex);
                              }}
                              onClick={(event) => {
                                if (event.detail === 0) {
                                  saveHistory(grid);
                                  paintCell(weekIndex, dayIndex, activeLevel);
                                }
                              }}
                              onFocus={() => setHoveredCell({ date, level: grid[weekIndex][dayIndex] })}
                              onContextMenu={(event) => {
                                event.preventDefault();
                                if (grid[weekIndex][dayIndex] !== 0) saveHistory(grid);
                                stopPainting();
                                paintCell(weekIndex, dayIndex, 0);
                              }}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="chart-bottomline">
              <span className="chart-hint"><MousePointer2 size={13} /> کلیک یا درگ برای نقاشی · راست‌کلیک برای پاک‌کردن</span>
              <span className="hover-date">{hoveredCell ? `${formatDate(hoveredCell.date)} · سطح ${hoveredCell.level}` : "یک خانه را انتخاب کن"}</span>
            </div>
          </div>

          <div className="chart-legend">
            <span className="legend-label">کمتر</span>
            {PALETTE.map((color, level) => (
              <button
                key={level}
                className={`legend-cell ${activeLevel === level ? "selected" : ""}`}
                style={{ backgroundColor: color }}
                onClick={() => setActiveLevel(level)}
                title={level === 0 ? "پاک‌کن / بدون فعالیت" : `قلم سطح ${level}`}
                aria-label={level === 0 ? "انتخاب پاک‌کن" : `انتخاب سطح ${level}`}
                aria-pressed={activeLevel === level}
              />
            ))}
            <span className="legend-label">بیشتر</span>
            <span className="legend-current"><span style={{ background: PALETTE[activeLevel] }} /> قلم سطح {activeLevel}</span>
          </div>
        </div>

        <div className="editor-tools-grid">
          <div className="tool-card palette-card">
            <div className="tool-card-heading">
              <div className="tool-icon"><Paintbrush2 size={17} /></div>
              <div><h3>ابزار رنگ‌آمیزی</h3><p>شدت فعالیت را انتخاب کن</p></div>
            </div>
            <div className="brush-list">
              {PALETTE.map((color, level) => (
                <button key={level} className={`brush-option ${activeLevel === level ? "active" : ""}`} onClick={() => setActiveLevel(level)} aria-pressed={activeLevel === level}>
                  <span className="brush-swatch" style={{ background: color }} />
                  <span className="brush-text"><strong>{level === 0 ? "پاک‌کن" : `سطح ${level}`}</strong><small>{level === 0 ? "بدون فعالیت" : `${commitsPerLevel[level]} کامیت در روز`}</small></span>
                  {activeLevel === level && <Check size={15} className="brush-check" />}
                </button>
              ))}
            </div>
          </div>

          <div className="tool-card intensity-card">
            <div className="tool-card-heading">
              <div className="tool-icon"><Activity size={17} /></div>
              <div><h3>تنظیم شدت کامیت</h3><p>تعداد کامیت هر سطح در روز</p></div>
            </div>
            <div className="intensity-list">
              {[1, 2, 3, 4].map((level) => (
                <label className="intensity-row" key={level}>
                  <span className="intensity-level"><i style={{ background: PALETTE[level] }} /> سطح {level}</span>
                  <span className="number-control">
                    <input
                      aria-label={`تعداد کامیت سطح ${level}`}
                      type="number"
                      min={1}
                      max={20}
                      value={commitsPerLevel[level]}
                      onChange={(event) => updateCommitCount(level, event.target.value)}
                    />
                    <small>کامیت</small>
                  </span>
                </label>
              ))}
            </div>
            <div className="intensity-note"><Info size={14} /> مقدار رنگ نهایی را GitHub بر اساس سهم کامیت‌ها تعیین می‌کند؛ این تنظیم تعداد کامیت هدف را کنترل می‌کند، نه کد رنگ را.</div>
          </div>

          <div className="tool-card summary-card">
            <div className="tool-card-heading">
              <div className="tool-icon"><Layers3 size={17} /></div>
              <div><h3>خلاصه طرح</h3><p>نمای سریع از بوم فعلی</p></div>
            </div>
            <div className="summary-numbers">
              <div><strong>{stats.active.toLocaleString("fa-IR")}</strong><span>روز فعال</span></div>
              <div><strong>{(stats.levels[4]).toLocaleString("fa-IR")}</strong><span>روز با شدت بالا</span></div>
            </div>
            <div className="summary-estimate">
              <span>حجم کامیت هنگام تکمیل بازه</span>
              <strong>{totalCommits.toLocaleString("fa-IR")}</strong>
            </div>
            <button className="text-action" onClick={exportPlanAsJson}><ArrowDownToLine size={15} /> دانلود فقط فایل JSON <ArrowLeft size={14} /></button>
          </div>
        </div>

        {importMessage && <div className="inline-message"><Info size={15} /> {importMessage}<button onClick={() => setImportMessage("")} aria-label="بستن پیام"><X size={14} /></button></div>}
      </section>

      <section className="guide-section" id="guide">
        <div className="section-heading guide-heading">
          <div>
            <div className="section-kicker">FROM CANVAS TO PROFILE <span>02 / 03</span></div>
            <h2>چطور طرح را روی GitHub اجرا کنی؟</h2>
            <p>چهار قدم ساده؛ بدون ذخیره‌کردن توکن یا اتصال مستقیم اکانت به این سایت.</p>
          </div>
          <button className="guide-toggle" onClick={() => setMobileGuideOpen((value) => !value)}>
            راهنمای سریع <ChevronDown size={15} className={mobileGuideOpen ? "rotated" : ""} />
          </button>
        </div>

        <div className={`guide-grid ${mobileGuideOpen ? "guide-expanded" : ""}`}>
          <article className="guide-card">
            <div className="guide-number">01</div>
            <div className="guide-icon"><SquarePen size={19} /></div>
            <h3>طرح را نهایی کن</h3>
            <p>خانه‌ها را رنگ کن، تعداد کامیت هر سطح را تنظیم کن و تعداد کل کامیت‌ها را قبل از خروجی بررسی کن.</p>
            <span className="guide-tag">داخل همین صفحه</span>
          </article>
          <article className="guide-card">
            <div className="guide-number">02</div>
            <div className="guide-icon"><CloudDownload size={19} /></div>
            <h3>بسته GitHub را بگیر</h3>
            <p>از «خروجی برای GitHub» استفاده کن. ایمیل تأییدشده GitHub را وارد کن تا فایل ZIP شامل Workflow و طرح ساخته شود.</p>
            <span className="guide-tag">ZIP + JSON + Script</span>
          </article>
          <article className="guide-card">
            <div className="guide-number">03</div>
            <div className="guide-icon"><Github size={19} /></div>
            <h3>فایل‌ها را به ریپو اضافه کن</h3>
            <p>ZIP را باز کن و سه مسیر داخل آن را در ریشه یک ریپوی مستقل، روی شاخه پیش‌فرض، کپی و commit کن.</p>
            <span className="guide-tag">Default branch</span>
          </article>
          <article className="guide-card">
            <div className="guide-number">04</div>
            <div className="guide-icon"><Activity size={19} /></div>
            <h3>Backfill را اجرا کن</h3>
            <p>در تب Actions، اجرای دستی Contribution Art را با حالت backfill شروع کن. بعد از آن، اجرای روزانه خودکار فعال می‌ماند.</p>
            <span className="guide-tag">هر روز · 12:17 UTC</span>
          </article>
        </div>

        <div className="guide-details">
          <div className="guide-detail-main">
            <div className="detail-title"><ShieldCheck size={17} /><strong>پیش‌نیازهای لازم</strong></div>
            <div className="requirement-list">
              <span><Check size={14} /> ریپوی مستقل (نه fork)</span>
              <span><Check size={14} /> فعال بودن GitHub Actions و مجوز نوشتن</span>
              <span><Check size={14} /> ایمیل نویسنده تأییدشده در GitHub</span>
              <span><Check size={14} /> اجرای Workflow روی شاخه پیش‌فرض</span>
            </div>
          </div>
          <div className="guide-detail-side">
            <div className="detail-title"><CircleHelp size={17} /><strong>چند نکته مهم</strong></div>
            <p>GitHub رنگ خانه‌ها را مستقیم نمی‌پذیرد. Workflow برای هر سطح، تعداد مشخصی کامیت با تاریخ همان روز می‌سازد؛ رنگ نهایی را الگوریتم گیت‌هاب تعیین می‌کند و تطابق صددرصدی قابل تضمین نیست.</p>
            <a href="https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference" target="_blank" rel="noreferrer">قوانین رسمی Contribution Graph <ArrowUpRight size={13} /></a>
          </div>
        </div>
      </section>

      <section className="faq-section">
        <div className="section-heading">
          <div>
            <div className="section-kicker">GOOD TO KNOW <span>03 / 03</span></div>
            <h2>قبل از اجرا این‌ها را بدان</h2>
          </div>
        </div>
        <div className="faq-grid">
          <article className="faq-item"><strong>آیا گراف فعلی اکانتم از GitHub خوانده می‌شود؟</strong><p>خیر. این صفحه یک بوم طراحی ۵۳ هفته‌ای با چیدمان مشابه تقویم GitHub می‌سازد؛ داده‌ی حساب تو را نمی‌خواند و نیازی به دسترسی حساب ندارد.</p></article>
          <article className="faq-item"><strong>آیا رنگ خانه دقیقاً همان رنگ انتخابی می‌شود؟</strong><p>خیر. رنگ‌ها در این صفحه پیش‌نمایش سطح فعالیت‌اند. GitHub شدت رنگ را با تعداد contributionها و مقیاس داخلی خودش محاسبه می‌کند؛ تعداد کامیت‌ها قابل کنترل است، اما رنگ قطعی نیست.</p></article>
          <article className="faq-item"><strong>آیا برای اجرا باید PAT بسازم؟</strong><p>خیر. Workflow با مجوز محدود <code>GITHUB_TOKEN</code> خودش اجرا می‌شود و فقط دسترسی نوشتن محتوا در همان ریپو را می‌گیرد. این سایت هیچ رمز یا توکنی دریافت نمی‌کند.</p></article>
          <article className="faq-item"><strong>اگر طرح را بعداً تغییر بدهم چه می‌شود؟</strong><p>کامیت‌های قبلی حذف نمی‌شوند. می‌توانی طرح جدید را صادر کنی؛ اما برای کاهش فعالیت‌های قبلی باید تاریخچه کامیت‌های تولیدشده را جداگانه اصلاح کنی.</p></article>
          <article className="faq-item"><strong>کامیت‌ها چه چیزی به ریپو اضافه می‌کنند؟</strong><p>یک فایل متنی <code>contribution-art.log</code> با یک خط برای هر کامیت. این تغییر واقعی باعث می‌شود Git کامیت خالی نسازد و تاریخچه قابل بررسی بماند.</p></article>
          <article className="faq-item"><strong>اگر ریپو خصوصی باشد چه؟</strong><p>در تنظیمات پروفایل GitHub گزینه‌ی نمایش مشارکت‌های خصوصی را روشن کن؛ در غیر این صورت ممکن است contributionهای ریپوی خصوصی در نمای عمومی گراف دیده نشوند.</p></article>
        </div>
      </section>

      <footer className="footer">
        <a className="footer-brand" href="#top"><span className="brand-mark"><Layers3 size={16} /></span> VERDE<span className="brand-dot">.</span></a>
        <span>طراحی کن. خروجی بگیر. بگذار گراف داستانت را روایت کند.</span>
        <span className="footer-version">NEXT.JS · TYPESCRIPT · GITHUB ACTIONS</span>
      </footer>

      {isExportOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsExportOpen(false); }}>
          <section className="export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
            <div className="modal-topline"><span className="modal-kicker">FINAL STEP · EXPORT</span><button className="modal-close" onClick={() => setIsExportOpen(false)} aria-label="بستن"><X size={18} /></button></div>
            <div className="modal-icon"><Github size={22} /></div>
            <h2 id="export-title">بسته‌ی GitHub آماده شود؟</h2>
            <p className="modal-description">این اطلاعات داخل تنظیمات کامیت قرار می‌گیرد تا GitHub بتواند آن‌ها را به اکانتت نسبت بدهد. برای حفظ حریم خصوصی، بهتر است آدرس noreply گیت‌هاب را وارد کنی؛ هیچ توکن یا رمز عبوری لازم نیست.</p>

            <label className="field-label" htmlFor="author-name">نام نویسنده کامیت</label>
            <div className="input-wrap"><SquarePen size={15} /><input id="author-name" value={authorName} onChange={(event) => setAuthorName(event.target.value)} placeholder="نامی که در GitHub نمایش داده می‌شود" autoComplete="name" /></div>

            <label className="field-label" htmlFor="author-email">ایمیل تأییدشده‌ی GitHub <span className="required-label">ضروری</span></label>
            <div className="input-wrap"><span className="at-symbol">@</span><input id="author-email" type="email" value={authorEmail} onChange={(event) => setAuthorEmail(event.target.value)} placeholder="12345678+username@users.noreply.github.com" autoComplete="email" dir="ltr" /></div>
            <a className="email-help" href="https://github.com/settings/emails" target="_blank" rel="noreferrer">ایمیل متصل به اکانت را از کجا پیدا کنم؟ <ArrowUpRight size={13} /></a>

            <div className="export-summary">
              <div><span>روزهای طراحی‌شده</span><strong>{stats.active.toLocaleString("fa-IR")}</strong></div>
              <div><span>حداکثر کامیت در کل طرح</span><strong>{totalCommits.toLocaleString("fa-IR")}</strong></div>
              <div><span>بازه زمانی</span><strong>UTC · ۵۳ هفته</strong></div>
            </div>
            {isLargePlan && <div className="warning-box"><Info size={15} /> طرح حجیم است؛ بهتر است تعداد کامیت سطوح را پایین بیاوری تا اجرای اولیه سبک‌تر شود.</div>}
            {exportError && <div className="error-box">{exportError}</div>}
            <button className="button button-primary export-submit" onClick={exportPackage} disabled={isExporting}>
              {isExporting ? <span className="spinner" /> : <CloudDownload size={17} />}
              {isExporting ? "در حال ساخت بسته..." : "ساخت و دانلود ZIP"}
              {!isExporting && <ArrowLeft size={16} />}
            </button>
            <p className="modal-footnote"><ShieldCheck size={13} /> این صفحه اطلاعات ورود GitHub یا Personal Access Token را نمی‌گیرد.</p>
          </section>
        </div>
      )}
    </main>
  );
}
