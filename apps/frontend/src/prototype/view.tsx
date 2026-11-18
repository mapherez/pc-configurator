import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircuitBoard,
  Copy,
  Cpu,
  Globe2,
  Layers,
  MemoryStick,
  PcCase,
  Plus,
  RotateCcw,
  Search,
  Share2,
  TriangleAlert,
  Undo2,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  candidateConflicts,
  catalog,
  categories,
  compatibility,
  initialState,
  markets,
  price,
  restoreState,
  sample,
  selectedParts,
  shareUrl,
  stateFromUrl,
  storageKey,
  totals,
  translate,
} from "./model";
import type { Category, Language, Market, Selection, State, TextKey } from "./model";

const icons: Record<Category, LucideIcon> = {
  cpu: Cpu,
  motherboard: CircuitBoard,
  ram: MemoryStick,
  gpu: Layers,
  psu: Zap,
  case: PcCase,
};

function readInitialState(): { value: State; storageAvailable: boolean } {
  const fromUrl = stateFromUrl(window.location.href);
  let value = fromUrl ?? structuredClone(initialState);
  try {
    if (!fromUrl) value = restoreState(JSON.parse(localStorage.getItem(storageKey) ?? "null"));
    localStorage.setItem(storageKey, JSON.stringify(value));
    return { value, storageAvailable: true };
  } catch {
    return { value, storageAvailable: false };
  }
}

function PartGlyph({ category }: { category: Category }) {
  const Icon = icons[category];
  return (
    <div className={`part-glyph part-glyph-${category}`} aria-hidden="true">
      <Icon strokeWidth={1.1} />
    </div>
  );
}

function AssemblyDrawing({ selected }: { selected: Selection }) {
  const board = Boolean(selected.motherboard),
    cpu = Boolean(selected.cpu);
  const ram = Boolean(selected.ram),
    gpu = Boolean(selected.gpu),
    psu = Boolean(selected.psu);
  return (
    <svg className="assembly-drawing" viewBox="0 0 460 540" aria-hidden="true">
      <defs>
        <linearGradient id="case-metal" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#5a6068" />
          <stop offset=".35" stopColor="#292d33" />
          <stop offset="1" stopColor="#15171c" />
        </linearGradient>
        <linearGradient id="case-edge" x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#4a515b" />
          <stop offset="1" stopColor="#9299a3" />
        </linearGradient>
        <linearGradient id="gpu-body" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#7c858d" />
          <stop offset="1" stopColor="#3a424a" />
        </linearGradient>
        <pattern id="case-mesh" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="1.2" fill="#828a91" opacity=".42" />
        </pattern>
        <pattern id="board-traces" width="27" height="27" patternUnits="userSpaceOnUse">
          <path
            d="M0 8h14v19M8 0v14h19"
            fill="none"
            stroke="#84948d"
            strokeWidth=".65"
            opacity=".2"
          />
        </pattern>
      </defs>
      <ellipse cx="239" cy="506" rx="179" ry="20" fill="#101319" opacity=".13" />
      <path d="m85 71 32-23h262l-34 23Z" fill="url(#case-edge)" />
      <path d="m345 71 34-23v407l-34 25Z" fill="#23282e" />
      <rect x="85" y="71" width="260" height="409" rx="5" fill="url(#case-metal)" />
      <rect
        x="94"
        y="81"
        width="241"
        height="387"
        rx="2"
        fill="#1a1f25"
        stroke="#5e6670"
        strokeWidth=".7"
      />
      <rect
        x="111"
        y="102"
        width="191"
        height="264"
        rx="3"
        fill={board ? "#2e3c39" : "#242b30"}
        stroke={board ? "#566b60" : "#363f47"}
      />
      <rect
        x="111"
        y="102"
        width="191"
        height="264"
        fill="url(#board-traces)"
        opacity={board ? 1 : 0.25}
      />
      <rect x="118" y="108" width="30" height="94" rx="2" fill="#151d21" />
      <rect x="157" y="110" width="88" height="19" rx="2" fill="#182322" />
      <rect
        x="167"
        y="154"
        width="69"
        height="71"
        rx="3"
        fill={cpu ? "#aeb5b9" : "#364047"}
        stroke={cpu ? "#d1d7d8" : "#536068"}
      />
      {cpu && (
        <g className="installed-part">
          <rect x="176" y="163" width="51" height="53" rx="2" fill="#d1d5d5" />
          <path d="M182 169h39m-39 7h39m-39 7h39m-39 7h39m-39 7h39m-39 7h39" stroke="#99a3a6" />
          <rect x="190" y="177" width="23" height="23" fill="#535d61" rx="2" />
        </g>
      )}
      <g className={ram ? "installed-part" : ""} opacity={ram ? 1 : 0.27}>
        <rect x="254" y="140" width="10" height="112" rx="2" fill="#a4bfa5" />
        <rect x="272" y="140" width="10" height="112" rx="2" fill="#a4bfa5" />
        <path d="M256 149v91m18-91v91" stroke="#223b31" strokeWidth="4" />
      </g>
      <path d="M121 275h168m-168 25h168m-168 25h168" stroke="#111a1c" strokeWidth="8" />
      {gpu && (
        <g className="installed-part">
          <rect
            x="110"
            y="282"
            width="198"
            height="52"
            rx="4"
            fill="url(#gpu-body)"
            stroke="#909b9f"
          />
          <path
            d="M116 294h186m-186 6h186m-186 6h186m-186 6h186m-186 6h186m-186 6h186"
            stroke="#20292f"
            strokeWidth="1.5"
          />
          <rect x="113" y="282" width="190" height="4" fill="#b8ceb0" />
        </g>
      )}
      <rect x="101" y="386" width="226" height="70" rx="2" fill="#242b33" stroke="#414b56" />
      <rect x="112" y="394" width="113" height="53" rx="2" fill={psu ? "#0d1218" : "#303840"} />
      {psu && (
        <g className="installed-part">
          <circle cx="140" cy="420" r="19" fill="#202934" stroke="#53606d" />
          <path d="m128 409 23 23m-24-2 25-21M123 420h34m-17-17v34" stroke="#65727b" />
          <rect x="176" y="406" width="39" height="5" rx="2" fill="#abc0a4" />
          <rect x="176" y="417" width="29" height="3" rx="1" fill="#5a6671" />
        </g>
      )}
      <rect x="308" y="94" width="18" height="273" rx="2" fill="url(#case-mesh)" />
      {[139, 230, 321].map((y) => (
        <g key={y}>
          <circle cx="363" cy={y} r="28" fill="#141a20" stroke="#53616b" strokeWidth="1.2" />
          <circle cx="363" cy={y} r="20" fill="none" stroke="#9eb9a2" opacity=".8" />
          <circle cx="363" cy={y} r="7" fill="#44525a" />
          <path d={`M363 ${y - 7}q18 -17 17 4q-3 17-17 3q-19 18-18-4q3-16 18-3`} fill="#3b4a52" />
        </g>
      ))}
      <rect x="99" y="480" width="30" height="9" rx="2" fill="#30363e" />
      <rect x="305" y="480" width="30" height="9" rx="2" fill="#30363e" />
      <path d="M87 73h257v405" fill="none" stroke="#c9d0d3" opacity=".45" />
      {[101, 327].flatMap((x) =>
        [90, 457].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.2" fill="#87919a" />),
      )}
    </svg>
  );
}

export function ConfiguratorPrototype() {
  const [initial] = useState(readInitialState);
  const [state, setState] = useState(initial.value);
  const [category, setCategory] = useState<Category>("cpu");
  const [area, setArea] = useState<"catalog" | "assembly" | "summary">("catalog");
  const [query, setQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [compatibleOnly, setCompatibleOnly] = useState(false);
  const [past, setPast] = useState<Selection[]>([]);
  const [zoom, setZoom] = useState(1);
  const [modal, setModal] = useState<"share" | "compatibility" | null>(null);
  const [notice, setNotice] = useState<TextKey | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(initial.storageAvailable);
  const dialog = useRef<HTMLDialogElement>(null);
  const t = (key: TextKey, params?: Record<string, string | number>) =>
    translate(state.language, key, params);
  const selected = useMemo(() => selectedParts(state.selected), [state.selected]);
  const checks = useMemo(() => compatibility(state.selected), [state.selected]);
  const budget = useMemo(() => totals(selected, state.market), [selected, state.market]);
  const taxBasisPoints = markets[state.market].taxBasisPoints;
  const currency = useMemo(
    () =>
      new Intl.NumberFormat(state.language, {
        style: "currency",
        currency: markets[state.market].currency,
      }),
    [state.language, state.market],
  );
  const money = (minor: number | null | undefined) =>
    minor == null ? "—" : currency.format(minor / 100);
  const link = shareUrl(state, window.location.href);
  const next = categories.find((key) => !state.selected[key]);
  const visible = catalog.filter((part) => {
    if (part.category !== category) return false;
    if (
      query &&
      !`${part.name} ${part.brand} ${part.sku}`.toLowerCase().includes(query.trim().toLowerCase())
    )
      return false;
    if (compatibleOnly && candidateConflicts(part, state.selected)) return false;
    const gross = price(part, state.market)?.gross;
    return !maxPrice || gross == null || gross <= Number(maxPrice) * 100;
  });

  useEffect(() => {
    document.documentElement.lang = state.language;
    document.title = translate(state.language, "app");
    window.history.replaceState(null, "", shareUrl(state, window.location.href));
  }, [state]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (modal && !element.open) element.showModal();
    else if (!modal && element.open) element.close();
  }, [modal]);

  const updateState = (nextState: State) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextState));
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
    setState(nextState);
  };

  const focusCategory = (key: Category) => {
    setCategory(key);
    setQuery("");
    setMaxPrice("");
    setCompatibleOnly(false);
    setArea("catalog");
  };
  const changeSelection = (selection: Selection, message: TextKey = "changed") => {
    if (JSON.stringify(selection) === JSON.stringify(state.selected)) return;
    setPast((previous) => [...previous, state.selected].slice(-20));
    updateState({ ...state, selected: selection });
    setNotice(message);
  };
  const undo = () => {
    const previous = past.at(-1);
    if (!previous) return;
    updateState({ ...state, selected: previous });
    setPast((values) => values.slice(0, -1));
    setNotice("changed");
  };
  const remove = (key: Category) => {
    const updated = { ...state.selected };
    delete updated[key];
    changeSelection(updated);
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setNotice("shared");
    } catch {
      setNotice("copyFailed");
    }
  };
  const status: TextKey = checks.conflicts
    ? "conflict"
    : selected.length
      ? "compatible"
      : "incomplete";
  const StatusIcon = checks.conflicts ? TriangleAlert : Check;

  return (
    <div className="prototype">
      <a className="skip-link" href="#configurator">
        {t("skipToContent")}
      </a>
      <header className="workspace-header">
        <a className="wordmark" href="/prototype.html">
          <span className="brand-symbol" aria-hidden="true">
            <PcCase size={23} />
          </span>
          <strong>{t("app")}</strong>
          <span className="wordmark-dot" aria-hidden="true" />
        </a>
        <span className="workspace-label">{t("workspace")}</span>
        <div className="preferences">
          <label className="preference">
            <Globe2 size={15} aria-hidden="true" />
            <span className="sr-only">{t("market")}</span>
            <select
              aria-label={t("market")}
              value={state.market}
              onChange={(event) => {
                updateState({ ...state, market: event.target.value as Market });
                setMaxPrice("");
              }}
            >
              {Object.keys(markets).map((key) => (
                <option key={key} value={key}>
                  {t(`market_${key as Market}`)}
                </option>
              ))}
            </select>
            <ChevronDown size={13} aria-hidden="true" />
          </label>
          <label className="preference language-preference">
            <span className="sr-only">{t("language")}</span>
            <select
              aria-label={t("language")}
              value={state.language}
              onChange={(event) =>
                updateState({ ...state, language: event.target.value as Language })
              }
            >
              {(["pt-PT", "en-US"] as const).map((key) => (
                <option key={key} value={key}>
                  {t(`language_${key}`)}
                </option>
              ))}
            </select>
            <ChevronDown size={13} aria-hidden="true" />
          </label>
        </div>
      </header>

      <section className="workspace-intro">
        <div>
          <div className="eyebrow">
            <span aria-hidden="true" />
            {t("subtitle")}
          </div>
          <h1>{t("title")}</h1>
        </div>
        <div className="intro-actions">
          <button
            className="text-button"
            onClick={() => changeSelection({ ...sample }, "sampleLoaded")}
          >
            {t("sample")}
            <ArrowUpRight size={15} />
          </button>
          <span className="intro-divider" />
          <button
            className="icon-button"
            onClick={undo}
            disabled={!past.length}
            aria-label={t("undo")}
            title={t("undo")}
          >
            <Undo2 size={18} />
          </button>
          <button
            className="icon-button"
            onClick={() => changeSelection({}, "cleared")}
            disabled={!selected.length}
            aria-label={t("reset")}
            title={t("reset")}
          >
            <RotateCcw size={17} />
          </button>
        </div>
      </section>

      <nav className="mobile-areas" aria-label={t("workspace")}>
        {(["catalog", "assembly", "summary"] as const).map((key) => (
          <button
            key={key}
            aria-current={area === key ? "page" : undefined}
            onClick={() => setArea(key)}
          >
            {t(key)}
            {key === "summary" && selected.length > 0 && <span>{selected.length}</span>}
          </button>
        ))}
      </nav>

      <main id="configurator" className={`configurator-grid area-${area}`}>
        <section className="catalog-panel panel" aria-labelledby="catalog-title">
          <div className="panel-top">
            <h2 id="catalog-title">{t("catalog")}</h2>
            <span className="step-counter">
              {String(categories.indexOf(category) + 1).padStart(2, "0")}
              <span> / {String(categories.length).padStart(2, "0")}</span>
            </span>
          </div>
          <nav className="category-nav" aria-label={t("catalog")}>
            {categories.map((key) => {
              const Icon = icons[key];
              return (
                <button
                  key={key}
                  className={category === key ? "active" : ""}
                  onClick={() => focusCategory(key)}
                  aria-current={category === key ? "step" : undefined}
                  aria-label={t("selectCategory", { category: t(key) })}
                >
                  <span className="category-icon">
                    <Icon size={19} strokeWidth={1.5} />
                    {state.selected[key] && (
                      <span className="category-selected">
                        <Check size={8} />
                      </span>
                    )}
                  </span>
                  <span>{t(key)}</span>
                </button>
              );
            })}
          </nav>
          <div className="catalog-filters">
            <label className="search-field">
              <Search size={16} aria-hidden="true" />
              <input
                aria-label={t("search")}
                placeholder={t("searchPlaceholder")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button aria-label={t("clearFilters")} onClick={() => setQuery("")}>
                  <X size={14} />
                </button>
              )}
            </label>
            <div className="filter-bottom">
              <label className="compatible-filter">
                <input
                  type="checkbox"
                  checked={compatibleOnly}
                  onChange={(event) => setCompatibleOnly(event.target.checked)}
                />
                <span>{t("compatibleOnly")}</span>
              </label>
              <input
                className="price-filter"
                type="number"
                min="0"
                step="1"
                disabled={!markets[state.market].hasPrices}
                aria-label={t("priceLimit")}
                title={t("priceLimit")}
                placeholder={t("allPrices")}
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
              />
            </div>
          </div>
          <div className="catalog-heading">
            <div>
              <h3>{t(category)}</h3>
              <span>{t("results", { count: visible.length })}</span>
            </div>
            <span className="currency-note">{markets[state.market].currency}</span>
          </div>
          <div className="parts-list">
            {visible.map((part) => {
              const isSelected = state.selected[category] === part.id;
              const conflict = candidateConflicts(part, state.selected);
              const partPrice = price(part, state.market);
              const current = selected.find((item) => item.category === category);
              const currentGross = current && price(current, state.market)?.gross;
              const delta =
                partPrice && currentGross != null ? partPrice.gross - currentGross : null;
              return (
                <article
                  key={part.id}
                  className={`part-card ${isSelected ? "selected" : ""}`}
                  aria-label={part.name}
                >
                  <div className="part-card-top">
                    <PartGlyph category={category} />
                    <div>
                      <span className="part-brand">{part.brand}</span>
                      <h4>{part.name}</h4>
                      <span className="part-reference">{part.sku || part.id}</span>
                    </div>
                    {isSelected && (
                      <span className="selected-mark" aria-label={t("selected")}>
                        <Check size={13} />
                      </span>
                    )}
                  </div>
                  <div className="spec-tags">
                    {Object.entries(part.specs)
                      .filter(([key]) =>
                        [
                          "socket",
                          "ram_type",
                          "form_factor",
                          "type",
                          "size_gb",
                          "wattage",
                          "length_mm",
                          "efficiency",
                        ].includes(key),
                      )
                      .slice(0, 3)
                      .map(([key, value]) => (
                        <span key={key}>
                          {String(value)}
                          {key === "size_gb"
                            ? " GB"
                            : key === "wattage"
                              ? " W"
                              : key === "length_mm"
                                ? " mm"
                                : ""}
                        </span>
                      ))}
                  </div>
                  {conflict && (
                    <div className="card-conflict">
                      <TriangleAlert size={12} />
                      {t("conflict")}
                    </div>
                  )}
                  <div className="part-card-bottom">
                    <div className="part-price">
                      <strong>{partPrice ? money(partPrice.gross) : "—"}</strong>
                      <small>{t(partPrice ? "grossPrice" : "unavailable")}</small>
                    </div>
                    <button
                      className={isSelected ? "part-action is-selected" : "part-action"}
                      disabled={isSelected}
                      aria-label={`${t(isSelected ? "selected" : current ? "replace" : "select")} ${part.name}`}
                      onClick={() => changeSelection({ ...state.selected, [category]: part.id })}
                    >
                      {isSelected ? <Check size={15} /> : <Plus size={15} />}
                      <span>{t(isSelected ? "selected" : current ? "replace" : "select")}</span>
                    </button>
                  </div>
                  {!isSelected && delta != null && (
                    <div className="price-delta">
                      {t("delta", { amount: `${delta >= 0 ? "+" : "−"}${money(Math.abs(delta))}` })}
                    </div>
                  )}
                </article>
              );
            })}
            {!visible.length && (
              <div className="empty-results">
                <Search size={25} />
                <p>{t("noResults")}</p>
                <button
                  className="text-button"
                  onClick={() => {
                    setQuery("");
                    setMaxPrice("");
                    setCompatibleOnly(false);
                  }}
                >
                  {t("clearFilters")}
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="stage-panel" aria-labelledby="assembly-title">
          <div className="stage-top">
            <span className="stage-kicker">
              <Layers size={14} />
              {t("assembly")}
            </span>
            <span className="progress-label">
              <span className="progress-track">
                <span style={{ width: `${(selected.length / categories.length) * 100}%` }} />
              </span>
              {t("progress", { count: selected.length, total: categories.length })}
            </span>
          </div>
          <div className="stage-heading">
            <h2 id="assembly-title">{t(selected.length ? "assembly" : "stageTitle")}</h2>
            <p>{t(selected.length ? "stageSelected" : "stageHint")}</p>
          </div>
          <div className="assembly-stage">
            <div className="stage-orbit orbit-one" />
            <div className="stage-orbit orbit-two" />
            <div className="assembly-object" style={{ transform: `scale(${zoom})` }}>
              <AssemblyDrawing selected={state.selected} />
              <div className="stage-slots">
                {categories.map((key) => (
                  <button
                    key={key}
                    className={`stage-slot slot-${key} ${state.selected[key] ? "filled" : ""} ${category === key ? "focused" : ""}`}
                    onClick={() => focusCategory(key)}
                    aria-label={t("selectCategory", { category: t(key) })}
                    title={t(key)}
                  >
                    <span>{state.selected[key] ? <Check size={10} /> : <Plus size={11} />}</span>
                    <span className="slot-tooltip">{t(key)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="stage-bottom">
            <span>{t("stageCaption")}</span>
            <div className="view-controls">
              <button
                className="icon-button"
                onClick={() => setZoom((value) => Math.max(0.8, value - 0.1))}
                disabled={zoom <= 0.8}
                aria-label={t("zoomOut")}
              >
                <ZoomOut size={17} />
              </button>
              <button className="icon-button" onClick={() => setZoom(1)} aria-label={t("recenter")}>
                <RotateCcw size={15} />
              </button>
              <button
                className="icon-button"
                onClick={() => setZoom((value) => Math.min(1.3, value + 0.1))}
                disabled={zoom >= 1.3}
                aria-label={t("zoomIn")}
              >
                <ZoomIn size={17} />
              </button>
            </div>
          </div>
          <button
            className={`compatibility-strip ${checks.conflicts ? "has-conflicts" : ""}`}
            onClick={() => setModal("compatibility")}
            aria-label={t("checkDetails")}
          >
            <span className="compatibility-icon">
              <StatusIcon size={18} />
            </span>
            <span>
              <strong>{t(status)}</strong>
              <small>{t(checks.pending ? "checksPending" : "compatibilityHint")}</small>
            </span>
            <ArrowUpRight size={17} />
          </button>
        </section>

        <aside className="summary-panel panel" aria-labelledby="summary-title">
          <div className="panel-top">
            <h2 id="summary-title">{t("summary")}</h2>
            <button
              className="icon-button"
              disabled={!selected.length}
              aria-label={t("share")}
              onClick={() => {
                setModal("share");
                setNotice(null);
              }}
            >
              <Share2 size={17} />
            </button>
          </div>
          <div className="summary-parts">
            {categories.map((key) => {
              const part = selected.find((item) => item.category === key);
              const Icon = icons[key];
              return (
                <div key={key} className={`summary-part ${part ? "has-part" : ""}`}>
                  <button
                    className="summary-part-link"
                    onClick={() => focusCategory(key)}
                    aria-label={t("selectCategory", { category: t(key) })}
                  >
                    <span className="summary-part-icon">
                      <Icon size={17} strokeWidth={1.4} />
                    </span>
                    <span>
                      <small>{t(key)}</small>
                      <strong>{part?.name ?? t("emptySlot")}</strong>
                      {part && (
                        <span className="summary-line-price">
                          {money(price(part, state.market)?.gross)}
                        </span>
                      )}
                    </span>
                  </button>
                  {part ? (
                    <button
                      className="remove-part"
                      aria-label={t("remove", { name: part.name })}
                      onClick={() => remove(key)}
                    >
                      <X size={13} />
                    </button>
                  ) : (
                    <Plus size={14} className="empty-plus" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="budget">
            <div className="power-metrics">
              <div>
                <Zap size={13} />
                <span>{t("power")}</span>
                <strong>{checks.tdp} W</strong>
              </div>
              <div>
                <CircuitBoard size={13} />
                <span>{t("recommendedPsu")}</span>
                <strong>{checks.recommended} W</strong>
              </div>
            </div>
            {!budget && (
              <p className="market-notice">
                <Globe2 size={15} />
                {t("marketUnavailable")}
              </p>
            )}
            <dl className="price-breakdown">
              <div>
                <dt>{t("netSubtotal")}</dt>
                <dd>{money(budget?.net)}</dd>
              </div>
              <div>
                <dt>
                  {taxBasisPoints === null
                    ? t("taxUnknown")
                    : t("tax", {
                        rate: new Intl.NumberFormat(state.language).format(taxBasisPoints / 100),
                      })}
                </dt>
                <dd>{money(budget?.tax)}</dd>
              </div>
            </dl>
            <div className="grand-total">
              <span>{t("total")}</span>
              <strong>{money(budget?.gross)}</strong>
            </div>
            <button
              className="primary-button share-button"
              disabled={!selected.length}
              onClick={() => {
                setModal("share");
                setNotice(null);
              }}
            >
              {t("share")}
              <ArrowUpRight size={17} />
            </button>
            <button
              className="next-button"
              onClick={() => {
                if (next) focusCategory(next);
              }}
              disabled={!next}
            >
              {next ? t("next", { category: t(next) }) : t("complete")}
              {next && <ArrowRight size={14} />}
            </button>
          </div>
        </aside>
      </main>

      <footer className="workspace-footer">
        <span className={storageAvailable ? "save-status" : "save-status is-error"}>
          <span />
          {t(storageAvailable ? "saved" : "storageUnavailable")}
        </span>
        <span className="live-notice" role="status">
          {notice && t(notice)}
        </span>
        <span>{t("app")}</span>
      </footer>

      <dialog
        ref={dialog}
        className="workspace-dialog"
        aria-labelledby="dialog-title"
        onCancel={() => setModal(null)}
      >
        <div className="dialog-top">
          <span className="eyebrow">{t(modal === "share" ? "share" : "checkDetails")}</span>
          <button className="icon-button" onClick={() => setModal(null)} aria-label={t("close")}>
            <X size={18} />
          </button>
        </div>
        <h2 id="dialog-title">{t(modal === "share" ? "shareTitle" : status)}</h2>
        {modal === "share" ? (
          <>
            <p>{t("shareHint")}</p>
            <input
              className="share-url"
              aria-label={t("share")}
              readOnly
              value={link}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              className="primary-button"
              onClick={() => {
                void copyLink();
              }}
            >
              <Copy size={16} />
              {t("copy")}
            </button>
            <p className="dialog-notice" role="status">
              {notice && t(notice)}
            </p>
          </>
        ) : (
          <>
            <p>{t("compatibilityHint")}</p>
            <ul className="rule-list">
              {checks.rules.map((rule) => (
                <li key={rule.id}>
                  <span
                    className={`rule-state ${rule.ok === false ? "failed" : rule.ok === true ? "passed" : "pending"}`}
                  >
                    {rule.ok === true ? (
                      <Check size={15} />
                    ) : rule.ok === false ? (
                      <X size={15} />
                    ) : (
                      <span>—</span>
                    )}
                  </span>
                  <span>
                    <strong>{t(`rule_${rule.id}`)}</strong>
                    <small>
                      {t(rule.ok === true ? "pass" : rule.ok === false ? "fail" : "pending")}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </dialog>
    </div>
  );
}
