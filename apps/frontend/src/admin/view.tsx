import { useEffect, useRef, useState, useCallback } from "react";
import {
  Download,
  Boxes,
  Settings2,
  Languages,
  ImagePlus,
  KeyRound,
  History,
  ArrowUpRight,
  LogOut,
  Plus,
  Search,
  X,
  Save,
  Eye,
  Upload,
  Archive,
  ShieldCheck,
  RefreshCw,
  PcCase,
} from "lucide-react";
import {
  AdminSessionSchema,
  ComponentSchema,
  LocaleValuesSchema,
  SettingsPatchSchema,
  dictionaries,
  parseMoney,
  translate,
  type AdminSession,
  type AdminState,
  type AdminDocument,
  type Component,
  type Language,
  type TextKey,
  type Snapshot,
} from "@pc-configurator/domain";
import { ConfiguratorWorkspace } from "../configurator/view";
import {
  api,
  session as loadSession,
  state as loadState,
  execute,
  preview as loadPreview,
  AdminError,
} from "./api";
import "./styles.css";

type T = (key: TextKey, params?: Record<string, string | number>) => string;
type Panel = "catalogue" | "settings" | "locales" | "media" | "access" | "audit";
type Run = (operation: string, input: unknown) => Promise<unknown>;
function errorKey(error: unknown): TextKey {
  const code =
    error instanceof AdminError
      ? error.code
      : error instanceof Error && error.message === "invalid_input"
        ? "invalid_input"
        : "generic";
  const key = `adminError_${code}`;
  return Object.hasOwn(dictionaries["pt-PT"], key) ? (key as TextKey) : "adminError_generic";
}
function useLanguage() {
  const [language, set] = useState<Language>(() => {
    try {
      return localStorage.getItem("pc-configurator:admin-language") === "en-US" ? "en-US" : "pt-PT";
    } catch {
      return "pt-PT";
    }
  });
  return [
    language,
    (next: Language) => {
      set(next);
      try {
        localStorage.setItem("pc-configurator:admin-language", next);
      } catch {
        /* Language remains in memory. */
      }
    },
  ] as const;
}
export function AdminApp() {
  const [language, setLanguage] = useLanguage();
  const [auth, setAuth] = useState<AdminSession | null>(null);
  const [error, setError] = useState<TextKey | null>(() =>
    new URL(location.href).searchParams.get("error") === "login_denied"
      ? "adminError_login_denied"
      : null,
  );
  const t: T = (key, params) => translate(language, key, params);
  useEffect(() => {
    const abort = new AbortController();
    void loadSession(abort.signal)
      .then((value) => setAuth(value))
      .catch((reason) => {
        if (!abort.signal.aborted) {
          setError(errorKey(reason));
          setAuth(AdminSessionSchema.parse({ configured: true, actor: null }));
        }
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = translate(language, "adminTitle");
  }, [language]);
  const revalidate = useCallback(async () => {
    const value = await loadSession();
    if (!value.actor) throw new AdminError("not_authenticated", 401);
    setAuth(value);
  }, []);
  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST", csrf: auth?.csrf });
    } catch (reason) {
      setError(errorKey(reason));
    } finally {
      setAuth({ configured: auth?.configured ?? false, actor: null });
    }
  };
  if (auth?.actor?.scopes.includes("pc:read")) {
    return location.pathname === "/admin/preview" ? (
      <Preview t={t} />
    ) : (
      <Workspace
        auth={auth}
        language={language}
        setLanguage={setLanguage}
        logout={logout}
        key={`${auth.actor.issuer}|${auth.actor.subject}`}
        revalidate={revalidate}
      />
    );
  }
  return (
    <main className="admin-login" lang={language}>
      <section className="admin-login-story">
        <a href="/">
          <PcCase size={24} />
          {t("app")}
        </a>
        <div>
          <span className="admin-eyebrow">{t("adminTitle")}</span>
          <h1>{t("adminLoginTitle")}</h1>
          <p>{t("adminLoginHint")}</p>
        </div>
        <span className="admin-login-decoration" aria-hidden="true">
          <Boxes size={170} strokeWidth={0.5} />
        </span>
      </section>
      <section className="admin-login-form">
        <div className="admin-language">
          <label>
            {t("language")}
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
            >
              <option value="pt-PT">{t("language_pt-PT")}</option>
              <option value="en-US">{t("language_en-US")}</option>
            </select>
          </label>
        </div>
        <div>
          <ShieldCheck size={32} strokeWidth={1.3} />
          <h2>{t("adminTitle")}</h2>
          {!auth ? (
            <p role="status">{t("adminLoading")}</p>
          ) : (
            <>
              {error && (
                <p className="admin-message is-error" role="alert">
                  {t(error)}
                </p>
              )}
              {auth.actor ? (
                <>
                  <p>{t("adminDenied")}</p>
                  <button className="admin-button" onClick={() => void logout()}>
                    {t("adminLogout")}
                  </button>
                </>
              ) : (
                <>
                  <p>{t(auth.configured ? "adminLoginHint" : "adminNotConfigured")}</p>
                  <form
                    method="post"
                    action={`/auth/nox/start?return_to=${encodeURIComponent(location.pathname + location.search)}`}
                  >
                    <button className="admin-button primary" disabled={!auth.configured}>
                      <KeyRound size={17} />
                      {t("adminLogin")}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
          <a className="admin-public-link" href="/">
            {t("adminPublic")}
            <ArrowUpRight size={16} />
          </a>
        </div>
      </section>
    </main>
  );
}
function Preview({ t }: { t: T }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<TextKey | null>(null);
  useEffect(() => {
    let active = true;
    void loadPreview()
      .then((value) => {
        if (active) setSnapshot(value);
      })
      .catch((reason) => {
        if (active) setError(errorKey(reason));
      });
    return () => {
      active = false;
    };
  }, []);
  if (error)
    return (
      <main className="connection-screen">
        <h1>{t("adminPreview")}</h1>
        <p role="alert">{t(error)}</p>
      </main>
    );
  return snapshot ? (
    <ConfiguratorWorkspace snapshot={snapshot} preview />
  ) : (
    <main className="connection-screen">
      <p role="status">{t("adminLoading")}</p>
    </main>
  );
}
function Workspace({
  auth,
  language,
  setLanguage,
  logout,
  revalidate,
}: {
  auth: AdminSession;
  language: Language;
  setLanguage: (value: Language) => void;
  logout: () => Promise<void>;
  revalidate: () => Promise<void>;
}) {
  const [data, setData] = useState<AdminState | null>(null);
  const [panel, setPanel] = useState<Panel>("catalogue");
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<TextKey | null>(null);
  const [notice, setNotice] = useState<TextKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [reauth, setReauth] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [confirmation, setConfirmation] = useState<{
    archive: boolean;
    action: () => Promise<void>;
  } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const importFile = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const t: T = (key, params) => translate(language, key, params, data?.snapshot.locales);
  const canWrite = auth.actor!.scopes.includes("pc:write"),
    canPublish = auth.actor!.scopes.includes("pc:publish"),
    owner = auth.actor!.scopes.includes("pc:admin");
  useEffect(() => {
    let active = true;
    void loadState()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((reason) => {
        if (active) setError(errorKey(reason));
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  useEffect(() => {
    if ((pending || confirmation || previewUrl) && !dialog.current?.open)
      dialog.current?.showModal();
    else if (!pending && !confirmation && !previewUrl && dialog.current?.open)
      dialog.current.close();
  }, [pending, confirmation, previewUrl]);
  const navigate = (action: () => void) => {
    if (dirty) setPending(() => action);
    else action();
  };
  const onError = useCallback((reason: unknown) => setError(errorKey(reason)), []);
  const run: Run = useCallback(
    async (operation, input) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const result = await execute(operation, input, auth.csrf!);
        if (!operation.endsWith("_preview") && !operation.endsWith("_list"))
          setData(await loadState());
        return result;
      } catch (reason) {
        setError(errorKey(reason));
        if (reason instanceof AdminError && reason.status === 401) setReauth(true);
        throw reason;
      } finally {
        setBusy(false);
      }
    },
    [auth.csrf],
  );
  const showPreview = (kind: string, id: string, revision: number) =>
    setPreviewUrl(
      `/admin/preview?${new URLSearchParams({ kind, id, revision: String(revision) })}`,
    );
  const confirm = (archive: boolean, action: () => Promise<void>) =>
    setConfirmation({ archive, action });
  const exportCatalogue = () => {
    if (!data) return;
    const components = [
      ...new Map(
        [
          ...data.components,
          ...data.documents
            .filter((document) => document.kind === "component")
            .map((document) => ComponentSchema.parse(document.draft)),
        ].map((component) => [component.id, component]),
      ).values(),
    ];
    const link = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob([JSON.stringify(components, null, 2)], { type: "application/json" }),
      );
    link.href = url;
    link.download = "pc-configurator-catalogue.json";
    link.click();
    URL.revokeObjectURL(url);
  };
  const importCatalogue = async (file?: File) => {
    if (!file || !data) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("invalid_input");
      const components = JSON.parse(await file.text()) as unknown;
      await run("catalog_import", {
        components,
        expectedRevisions: Object.fromEntries(
          data.documents
            .filter((document) => document.kind === "component")
            .map((document) => [document.id, document.revision]),
        ),
      });
      setNotice("adminImported");
    } catch (reason) {
      setError(reason instanceof AdminError ? errorKey(reason) : "adminError_invalid_input");
    }
  };
  const documents = data?.documents ?? [];
  const itemDocument = documents.find((item) => item.kind === "component" && item.id === selected);
  const item = itemDocument
    ? ComponentSchema.parse(itemDocument.draft)
    : data?.components.find((component) => component.id === selected);
  const components = [
    ...new Set([
      ...(data?.components.map((component) => component.id) ?? []),
      ...documents.filter((item) => item.kind === "component").map((item) => item.id),
    ]),
  ]
    .map((id) => {
      const stored = data?.components.find((component) => component.id === id);
      const document = documents.find((item) => item.kind === "component" && item.id === id);
      const draft = document ? ComponentSchema.parse(document.draft) : null;
      return {
        id,
        component: draft ?? stored!,
        status:
          stored?.status === "archived"
            ? "adminArchived"
            : document && document.revision > document.published_revision
              ? "adminUnpublished"
              : stored?.status === "published"
                ? "adminPublished"
                : "adminDraft",
      } as const;
    })
    .filter((entry) =>
      `${entry.component.name} ${entry.component.sku} ${entry.component.brand}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    );
  const nav = [
    ["catalogue", Boxes, "adminCatalogue"],
    ["settings", Settings2, "adminSettings"],
    ["locales", Languages, "adminLocales"],
    ["media", ImagePlus, "adminMedia"],
    ["access", KeyRound, "adminAccess"],
    ["audit", History, "adminAudit"],
  ] as const;
  return (
    <div className="admin-shell" lang={language}>
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/">
          <PcCase size={25} />
          <span>
            {t("app")}
            <small>{t("adminTitle")}</small>
          </span>
        </a>
        <nav aria-label={t("adminTitle")}>
          {nav
            .filter(([key]) => key !== "access" || owner)
            .map(([key, Icon, label]) => (
              <button
                key={key}
                aria-current={panel === key ? "page" : undefined}
                onClick={() =>
                  navigate(() => {
                    setPanel(key);
                    setSelected(null);
                    setDirty(false);
                  })
                }
              >
                <Icon size={18} />
                {t(label)}
              </button>
            ))}
        </nav>
        <div className="admin-account">
          <span>{auth.actor!.name || auth.actor!.email}</span>
          <small>{t(`adminRole_${auth.actor!.role}`)}</small>
          <button
            onClick={() =>
              navigate(() => {
                void logout();
              })
            }
          >
            <LogOut size={15} />
            {t("adminLogout")}
          </button>
        </div>
      </aside>
      <div className="admin-content">
        <header className="admin-toolbar">
          <span>
            <ShieldCheck size={15} />
            {t("adminTitle")}
          </span>
          <div>
            <select
              aria-label={t("language")}
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
            >
              <option value="pt-PT">{t("language_pt-PT")}</option>
              <option value="en-US">{t("language_en-US")}</option>
            </select>
            <a href="/">
              {t("adminPublic")}
              <ArrowUpRight size={15} />
            </a>
            <button
              className="admin-mobile-logout"
              aria-label={t("adminLogout")}
              title={t("adminLogout")}
              onClick={() =>
                navigate(() => {
                  void logout();
                })
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main className="admin-main">
          <div className="admin-intro">
            <div>
              <span className="admin-eyebrow">{t("adminEyebrow")}</span>
              <h1>
                {t(panel === "catalogue" ? "adminIntro" : nav.find(([key]) => key === panel)![2])}
              </h1>
            </div>
            <button
              className="admin-button"
              onClick={() =>
                navigate(() => {
                  void loadState()
                    .then((value) => {
                      setData(value);
                      setGeneration((value) => value + 1);
                      setDirty(false);
                    })
                    .catch((reason) => setError(errorKey(reason)));
                })
              }
            >
              <RefreshCw size={15} />
              {t("adminReload")}
            </button>
          </div>
          {error && (
            <p className="admin-message is-error" role="alert">
              {t(error)}
            </p>
          )}
          {reauth && (
            <div className="admin-reauth">
              <p>{t("adminReauthHint")}</p>
              <form action="/auth/nox/start?return_to=%2Fadmin" method="post" target="_blank">
                <button className="admin-button primary">{t("adminReauthLogin")}</button>
              </form>
              <button
                className="admin-button"
                onClick={() => {
                  void revalidate()
                    .then(() => {
                      setReauth(false);
                      setError(null);
                    })
                    .catch((reason) => setError(errorKey(reason)));
                }}
              >
                {t("adminReauthCheck")}
              </button>
            </div>
          )}
          {notice && (
            <p className="admin-message" role="status">
              {t(notice)}
            </p>
          )}
          {!data ? (
            <p role="status">{t("adminLoading")}</p>
          ) : (
            <>
              {panel === "catalogue" && (
                <>
                  <div className="admin-stat-row">
                    <span>
                      {t("adminPublishedCount", { count: data.snapshot.components.length })}
                    </span>
                    <span>
                      {t(
                        documents.filter(
                          (document) => document.revision > document.published_revision,
                        ).length === 1
                          ? "adminDraftCount_one"
                          : "adminDraftCount",
                        {
                          count: documents.filter(
                            (document) => document.revision > document.published_revision,
                          ).length,
                        },
                      )}
                    </span>
                  </div>
                  <div className="admin-catalogue-layout">
                    <section className="admin-card admin-catalogue-list">
                      <div className="admin-list-heading">
                        <h2>{t("adminCatalogue")}</h2>
                        {canWrite && (
                          <button
                            className="admin-button primary"
                            onClick={() =>
                              navigate(() => {
                                setSelected("__new__");
                                setDirty(false);
                              })
                            }
                          >
                            <Plus size={15} />
                            {t("adminNew")}
                          </button>
                        )}
                      </div>
                      <label className="admin-search">
                        <Search size={16} />
                        <input
                          aria-label={t("adminSearch")}
                          placeholder={t("adminSearch")}
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                        />
                      </label>
                      <div className="admin-catalogue-tools">
                        <button className="admin-button" onClick={exportCatalogue}>
                          <Download size={14} />
                          {t("adminExport")}
                        </button>
                        {canWrite && (
                          <>
                            <input
                              hidden
                              ref={importFile}
                              type="file"
                              accept="application/json,.json"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                navigate(() => {
                                  void importCatalogue(file);
                                });
                              }}
                            />
                            <button
                              className="admin-button"
                              disabled={busy}
                              onClick={() => importFile.current?.click()}
                            >
                              <Upload size={14} />
                              {t("adminImport")}
                            </button>
                          </>
                        )}
                      </div>
                      <div className="admin-item-list">
                        {components.map((entry) => (
                          <button
                            key={entry.id}
                            className={selected === entry.id ? "selected" : ""}
                            onClick={() =>
                              navigate(() => {
                                setSelected(entry.id);
                                setDirty(false);
                              })
                            }
                          >
                            <span>
                              <small>
                                {t(entry.component.category)} · {entry.component.brand}
                              </small>
                              <strong>{entry.component.name}</strong>
                              <small>{entry.component.sku}</small>
                            </span>
                            <span
                              className={`admin-badge ${entry.status === "adminPublished" ? "published" : ""}`}
                            >
                              {t(entry.status)}
                            </span>
                          </button>
                        ))}
                        {!components.length && <p>{t("adminEmpty")}</p>}
                      </div>
                    </section>
                    <section className="admin-card admin-editor">
                      {selected ? (
                        <ComponentEditor
                          key={`${selected}:${generation}`}
                          component={item}
                          document={itemDocument}
                          data={data}
                          t={t}
                          run={run}
                          canWrite={canWrite}
                          canPublish={canPublish}
                          busy={busy}
                          dirty={setDirty}
                          saved={(id) => {
                            setSelected(id);
                            setDirty(false);
                            setNotice("adminSaved");
                          }}
                          preview={showPreview}
                          confirm={confirm}
                          published={(archive) =>
                            setNotice(archive ? "adminArchiveNotice" : "adminPublishedNotice")
                          }
                        />
                      ) : (
                        <div className="admin-empty-editor">
                          <Boxes size={44} strokeWidth={1} />
                          <h2>{t("adminEmptyEditor")}</h2>
                          <p>{t("adminRevisionHint")}</p>
                        </div>
                      )}
                    </section>
                  </div>
                </>
              )}
              {panel === "settings" && (
                <JsonEditor
                  key={`settings:${generation}`}
                  kind="settings"
                  id="site"
                  data={data}
                  t={t}
                  run={run}
                  canWrite={canWrite}
                  canPublish={canPublish}
                  busy={busy}
                  dirty={setDirty}
                  notice={setNotice}
                  preview={showPreview}
                  confirm={confirm}
                />
              )}
              {panel === "locales" && (
                <JsonEditor
                  key={`locales:${generation}`}
                  kind="locale"
                  id={language}
                  data={data}
                  t={t}
                  run={run}
                  canWrite={canWrite}
                  canPublish={canPublish}
                  busy={busy}
                  dirty={setDirty}
                  notice={setNotice}
                  preview={showPreview}
                  confirm={confirm}
                />
              )}
              {panel === "media" && (
                <Media
                  data={data}
                  t={t}
                  run={run}
                  canWrite={canWrite}
                  busy={busy}
                  notice={setNotice}
                />
              )}
              {panel === "access" && owner && (
                <Access auth={auth} t={t} language={language} onError={onError} />
              )}
              {panel === "audit" && <Audit t={t} run={run} language={language} />}
            </>
          )}
        </main>
      </div>
      <dialog
        ref={dialog}
        className={`admin-dialog ${previewUrl ? "is-preview" : ""}`}
        onCancel={() => {
          setPending(null);
          setConfirmation(null);
          setPreviewUrl(null);
        }}
      >
        <button
          className="admin-dialog-close"
          aria-label={t("close")}
          onClick={() => {
            setPending(null);
            setConfirmation(null);
            setPreviewUrl(null);
          }}
        >
          <X size={20} />
        </button>
        {pending && (
          <>
            <h2>{t("adminDirtyTitle")}</h2>
            <p>{t("adminDirtyHint")}</p>
            <div className="admin-actions">
              <button className="admin-button" onClick={() => setPending(null)}>
                {t("adminKeepEditing")}
              </button>
              <button
                className="admin-button danger"
                onClick={() => {
                  const action = pending;
                  setPending(null);
                  setDirty(false);
                  action();
                }}
              >
                {t("adminDiscard")}
              </button>
            </div>
          </>
        )}
        {confirmation && (
          <>
            <h2>{t(confirmation.archive ? "adminConfirmArchive" : "adminConfirmPublish")}</h2>
            <p>{t(confirmation.archive ? "adminConfirmArchiveHint" : "adminConfirmPublishHint")}</p>
            <div className="admin-actions">
              <button className="admin-button" onClick={() => setConfirmation(null)}>
                {t("adminCancel")}
              </button>
              <button
                className="admin-button primary"
                disabled={busy}
                onClick={() => {
                  void confirmation
                    .action()
                    .then(() => setConfirmation(null))
                    .catch(() => setConfirmation(null));
                }}
              >
                {t(confirmation.archive ? "adminArchive" : "adminPublish")}
              </button>
            </div>
          </>
        )}
        {previewUrl && (
          <>
            <h2>{t("adminPreview")}</h2>
            <iframe title={t("adminPreview")} src={previewUrl} />
          </>
        )}
      </dialog>
    </div>
  );
}
function ComponentEditor({
  component,
  document,
  data,
  t,
  run,
  canWrite,
  canPublish,
  busy,
  dirty,
  saved,
  preview,
  confirm,
  published,
}: {
  component?: Component;
  document?: AdminDocument;
  data: AdminState;
  t: T;
  run: Run;
  canWrite: boolean;
  canPublish: boolean;
  busy: boolean;
  dirty: (value: boolean) => void;
  saved: (id: string) => void;
  preview: (kind: string, id: string, revision: number) => void;
  confirm: (archive: boolean, action: () => Promise<void>) => void;
  published: (archive: boolean) => void;
}) {
  const [value, setValue] = useState<Component>(
    () =>
      component ?? {
        id: "",
        sku: "",
        name: "",
        brand: "",
        category: "cpu",
        status: "draft",
        specs: {},
        variant: {},
        images: [],
        offers: [],
      },
  );
  const [specs, setSpecs] = useState(() => JSON.stringify(component?.specs ?? {}, null, 2));
  const [variant, setVariant] = useState(() => JSON.stringify(component?.variant ?? {}, null, 2));
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(data.snapshot.settings.markets).map(([id, market]) => {
        const offer = component?.offers.find((entry) => entry.market === id);
        return [
          id,
          offer ? (offer.netMinor / 10 ** market.minorDigits).toFixed(market.minorDigits) : "",
        ];
      }),
    ),
  );
  const [revision, setRevision] = useState(document?.revision ?? 0);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState<TextKey | null>(null);
  const touch = () => {
    setChanged(true);
    dirty(true);
    setError(null);
  };
  const update = (key: keyof Component, next: unknown) => {
    const slug = (input: string) =>
      input
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 120)
        .replace(/-$/, "");
    setValue((current) => ({
      ...current,
      ...(!component && key === "name" && (!current.id || current.id === slug(current.name))
        ? { id: slug(String(next)) }
        : {}),
      [key]: next,
    }));
    touch();
  };
  const save = async () => {
    let validated = false;
    try {
      const offers = Object.entries(prices)
        .filter(([, text]) => text.trim())
        .map(([market, text]) => {
          const settings = data.snapshot.settings.markets[market],
            amount = parseMoney(text, settings.minorDigits);
          if (amount === null) throw new Error("invalid_input");
          return {
            market,
            currency: settings.currency,
            netMinor: amount,
            available: value.offers.find((entry) => entry.market === market)?.available ?? true,
          };
        });
      const parsed = ComponentSchema.parse({
        ...value,
        specs: JSON.parse(specs),
        variant: JSON.parse(variant),
        offers,
        status: "draft",
      });
      validated = true;
      const result = (await run("component_save", {
        component: parsed,
        expectedRevision: revision,
      })) as { id: string; revision: number };
      setRevision(result.revision);
      setChanged(false);
      saved(result.id);
    } catch (reason) {
      setError(validated ? errorKey(reason) : "adminError_invalid_input");
    }
  };
  return (
    <>
      <div className="admin-editor-heading">
        <div>
          <span className="admin-eyebrow">{t(component ? "adminCatalogue" : "adminNew")}</span>
          <h2>{component?.name || t("adminNew")}</h2>
        </div>
        <span className="admin-badge">{t("adminRevision", { revision })}</span>
      </div>
      <p className="admin-muted">{t("adminRevisionHint")}</p>
      {error && (
        <p className="admin-message is-error" role="alert">
          {t(error)}
        </p>
      )}
      <fieldset disabled={!canWrite || busy} className="admin-form">
        <div className="admin-form-grid">
          {(
            [
              ["name", "adminName"],
              ["id", "adminId"],
              ["brand", "adminBrand"],
              ["sku", "adminSku"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {t(label)}
              <input
                value={value[key]}
                disabled={key === "id" && Boolean(component)}
                onChange={(event) => update(key, event.target.value)}
              />
            </label>
          ))}
          <label>
            {t("adminCategory")}
            <select
              value={value.category}
              onChange={(event) => update("category", event.target.value)}
            >
              {["cpu", "motherboard", "ram", "gpu", "psu", "case", "storage", "cooler", "fan"].map(
                (category) => (
                  <option key={category} value={category}>
                    {t(category as TextKey)}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            {t("adminProductId")}
            <input
              value={value.productId ?? ""}
              onChange={(event) => update("productId", event.target.value || undefined)}
            />
          </label>
        </div>
        <h3>{t("adminOffers")}</h3>
        <p className="admin-muted">{t("adminNoOffer")}</p>
        <div className="admin-offers">
          {Object.entries(data.snapshot.settings.markets).map(([id, market]) => (
            <div key={id}>
              <strong>
                {t(market.nameKey)} <small>{market.currency}</small>
              </strong>
              <label>
                {t("adminNetPrice")}
                <input
                  inputMode="decimal"
                  aria-label={`${t("adminNetPrice")} · ${t(market.nameKey)}`}
                  value={prices[id] ?? ""}
                  onChange={(event) => {
                    setPrices((current) => ({ ...current, [id]: event.target.value }));
                    touch();
                  }}
                />
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  aria-label={`${t("adminAvailable")} · ${t(market.nameKey)}`}
                  checked={value.offers.find((offer) => offer.market === id)?.available ?? true}
                  onChange={(event) => {
                    const existing = value.offers.find((offer) => offer.market === id) ?? {
                      market: id,
                      currency: market.currency,
                      netMinor: 0,
                      available: true,
                    };
                    update("offers", [
                      ...value.offers.filter((offer) => offer.market !== id),
                      { ...existing, available: event.target.checked },
                    ]);
                  }}
                />
                {t("adminAvailable")}
              </label>
            </div>
          ))}
        </div>
        <h3>{t("adminImages")}</h3>
        <div className="admin-image-strip">
          {value.images
            .filter((image) => image.startsWith("/media/"))
            .map((image) => (
              <span key={image}>
                <img src={`/api/admin/assets/${image.slice(7)}/file`} alt={value.name} />
                <button
                  type="button"
                  aria-label={t("adminImageRemove")}
                  onClick={() =>
                    update(
                      "images",
                      value.images.filter((entry) => entry !== image),
                    )
                  }
                >
                  <X size={14} />
                </button>
              </span>
            ))}
        </div>
        <label>
          {t("adminChooseImage")}
          <select
            value=""
            onChange={(event) => {
              if (event.target.value && !value.images.includes(`/media/${event.target.value}`))
                update("images", [...value.images, `/media/${event.target.value}`]);
            }}
          >
            <option value="">{t("adminChooseImage")}</option>
            {data.assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.filename}
              </option>
            ))}
          </select>
        </label>
        <details className="admin-advanced">
          <summary>{t("adminAdvanced")}</summary>
          <label>
            {t("adminSpecs")}
            <textarea
              rows={8}
              spellCheck={false}
              value={specs}
              onChange={(event) => {
                setSpecs(event.target.value);
                touch();
              }}
            />
          </label>
          <label>
            {t("adminVariants")}
            <textarea
              rows={5}
              spellCheck={false}
              value={variant}
              onChange={(event) => {
                setVariant(event.target.value);
                touch();
              }}
            />
          </label>
        </details>
      </fieldset>
      <div className="admin-editor-actions">
        {canWrite && (
          <button
            className="admin-button primary"
            disabled={busy || (!changed && Boolean(document))}
            onClick={() => void save()}
          >
            <Save size={16} />
            {t(busy ? "adminSaving" : "adminSave")}
          </button>
        )}
        <button
          className="admin-button"
          disabled={!revision || changed || busy}
          onClick={() => preview("component", value.id, revision)}
        >
          <Eye size={16} />
          {t("adminPreview")}
        </button>
        {canPublish && (
          <button
            className="admin-button"
            disabled={!revision || changed || busy || revision === document?.published_revision}
            onClick={() =>
              confirm(false, async () => {
                await run("component_publish", { id: value.id, revision });
                published(false);
              })
            }
          >
            <Upload size={16} />
            {t("adminPublish")}
          </button>
        )}
        {canPublish && component && (
          <button
            className="admin-button danger"
            disabled={changed || busy}
            onClick={() =>
              confirm(true, async () => {
                const result = (await run("component_archive", { id: value.id, revision })) as {
                  revision: number;
                };
                setRevision(result.revision);
                published(true);
              })
            }
          >
            <Archive size={16} />
            {t("adminArchive")}
          </button>
        )}
      </div>
    </>
  );
}
function JsonEditor({
  kind,
  id: initialId,
  data,
  t,
  run,
  canWrite,
  canPublish,
  busy,
  dirty,
  notice,
  preview,
  confirm,
}: {
  kind: "settings" | "locale";
  id: string;
  data: AdminState;
  t: T;
  run: Run;
  canWrite: boolean;
  canPublish: boolean;
  busy: boolean;
  dirty: (value: boolean) => void;
  notice: (key: TextKey) => void;
  preview: (kind: string, id: string, revision: number) => void;
  confirm: (archive: boolean, action: () => Promise<void>) => void;
}) {
  const [id, setId] = useState(initialId);
  const document = data.documents.find((entry) => entry.kind === kind && entry.id === id);
  const initial = (target: string) =>
    data.documents.find((entry) => entry.kind === kind && entry.id === target)?.draft ??
    (kind === "settings"
      ? data.snapshot.settings
      : { ...dictionaries[target as Language], ...data.snapshot.locales?.[target as Language] });
  const [text, setText] = useState(() => JSON.stringify(initial(id), null, 2));
  const [revision, setRevision] = useState(document?.revision ?? 0),
    [changed, setChanged] = useState(false),
    [error, setError] = useState<TextKey | null>(null);
  const save = async () => {
    let validated = false;
    try {
      const value =
        kind === "settings"
          ? SettingsPatchSchema.parse(JSON.parse(text))
          : LocaleValuesSchema.parse(JSON.parse(text));
      validated = true;
      const result = (await run(`${kind}_save`, {
        ...(kind === "locale" ? { language: id } : {}),
        value,
        expectedRevision: revision,
      })) as { revision: number };
      setRevision(result.revision);
      setChanged(false);
      dirty(false);
      notice("adminSaved");
    } catch (reason) {
      setError(validated ? errorKey(reason) : "adminError_invalid_input");
    }
  };
  return (
    <section className="admin-card admin-json-editor">
      <h2>{t(kind === "settings" ? "adminSettings" : "adminLocales")}</h2>
      <p className="admin-muted">{t(kind === "settings" ? "adminJsonHint" : "adminLocaleHint")}</p>
      {kind === "locale" && (
        <label>
          {t("language")}
          <select
            value={id}
            disabled={changed}
            onChange={(event) => {
              const next = event.target.value;
              setId(next);
              setText(JSON.stringify(initial(next), null, 2));
              setRevision(
                data.documents.find((entry) => entry.kind === kind && entry.id === next)
                  ?.revision ?? 0,
              );
            }}
          >
            <option value="pt-PT">{t("language_pt-PT")}</option>
            <option value="en-US">{t("language_en-US")}</option>
          </select>
        </label>
      )}
      {error && (
        <p role="alert" className="admin-message is-error">
          {t(error)}
        </p>
      )}
      <label>
        {t(kind === "settings" ? "adminSettings" : "adminLocales")}
        <textarea
          className="admin-code-editor"
          rows={24}
          spellCheck={false}
          value={text}
          disabled={!canWrite || busy}
          onChange={(event) => {
            setText(event.target.value);
            setChanged(true);
            dirty(true);
            setError(null);
          }}
        />
      </label>
      <div className="admin-editor-actions">
        {canWrite && (
          <button
            className="admin-button primary"
            disabled={busy || !changed}
            onClick={() => void save()}
          >
            <Save size={16} />
            {t("adminSave")}
          </button>
        )}
        <button
          className="admin-button"
          disabled={!revision || changed || busy}
          onClick={() => preview(kind, id, revision)}
        >
          <Eye size={16} />
          {t("adminPreview")}
        </button>
        {canPublish && (
          <button
            className="admin-button"
            disabled={!revision || changed || busy || revision === document?.published_revision}
            onClick={() =>
              confirm(false, async () => {
                await run(`${kind}_publish`, {
                  ...(kind === "locale" ? { language: id } : {}),
                  revision,
                });
                notice("adminPublishedNotice");
              })
            }
          >
            <Upload size={16} />
            {t("adminPublish")}
          </button>
        )}
        <small>{t("adminRevision", { revision })}</small>
      </div>
    </section>
  );
}
function Media({
  data,
  t,
  run,
  canWrite,
  busy,
  notice,
}: {
  data: AdminState;
  t: T;
  run: Run;
  canWrite: boolean;
  busy: boolean;
  notice: (key: TextKey) => void;
}) {
  const [error, setError] = useState<TextKey | null>(null);
  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("adminError_invalid_image");
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      await run("asset_upload", { filename: file.name, base64: btoa(binary) });
      notice("adminImageAdded");
      setError(null);
    } catch (reason) {
      setError(errorKey(reason));
    }
  };
  return (
    <section className="admin-card admin-media">
      <h2>{t("adminMedia")}</h2>
      <p className="admin-muted">{t("adminUploadHint")}</p>
      {canWrite && (
        <label className="admin-upload-button">
          <ImagePlus size={20} />
          {t("adminUpload")}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(event) => {
              void upload(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      )}
      {error && (
        <p className="admin-message is-error" role="alert">
          {t(error)}
        </p>
      )}
      <div className="admin-media-grid">
        {data.assets.map((asset) => (
          <figure key={asset.id}>
            <img src={`/api/admin/assets/${asset.id}/file`} alt={asset.filename} />
            <figcaption>
              <strong>{asset.filename}</strong>
              <small>{new Intl.NumberFormat().format(asset.bytes)} B</small>
            </figcaption>
          </figure>
        ))}
      </div>
      {!data.assets.length && <p>{t("adminNoImages")}</p>}
    </section>
  );
}
function Access({
  auth,
  t,
  onError,
  language,
}: {
  auth: AdminSession;
  t: T;
  onError: (reason: unknown) => void;
  language: Language;
}) {
  const [users, setUsers] = useState<NonNullable<AdminSession["actor"]>[]>([]),
    [tokens, setTokens] = useState<
      { id: string; name: string; scopes: string; expires: number; revoked: number }[]
    >([]);
  const [name, setName] = useState(""),
    [hours, setHours] = useState(1),
    [write, setWrite] = useState(false),
    [publish, setPublish] = useState(false),
    [created, setCreated] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.all([api("/api/admin/users"), api("/api/admin/delegations")])
      .then(([people, keys]) => {
        if (active) {
          setUsers(people as typeof users);
          setTokens(keys as typeof tokens);
        }
      })
      .catch(onError);
    return () => {
      active = false;
    };
  }, [onError]);
  const perform = async (path: string, body?: unknown, method = "POST") => {
    setBusy(true);
    try {
      const result = await api(path, { method, body, csrf: auth.csrf });
      setUsers((await api("/api/admin/users")) as typeof users);
      setTokens((await api("/api/admin/delegations")) as typeof tokens);
      return result;
    } catch (reason) {
      onError(reason);
      throw reason;
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="admin-access-grid">
      <section className="admin-card">
        <h2>{t("adminUsers")}</h2>
        <p className="admin-muted">{t("adminRoleHint")}</p>
        {users.map((user) => (
          <div className="admin-user" key={`${user.issuer}|${user.subject}`}>
            <span>
              <strong>{user.name || user.email}</strong>
              <small>{user.email}</small>
            </span>
            <select
              aria-label={`${t("adminRole")} ${user.email}`}
              value={user.role}
              disabled={busy}
              onChange={(event) => {
                void perform("/api/admin/users", {
                  issuer: user.issuer,
                  subject: user.subject,
                  role: event.target.value,
                }).catch(() => {});
              }}
            >
              {(["unassigned", "viewer", "editor", "publisher", "owner"] as const).map((role) => (
                <option key={role} value={role}>
                  {t(`adminRole_${role}`)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </section>
      <section className="admin-card">
        <h2>{t("adminDelegations")}</h2>
        <p className="admin-muted">{t("adminDelegationHint")}</p>
        <form
          className="admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            void perform("/api/admin/delegations", {
              name,
              hours,
              scopes: [
                "pc:read",
                ...(write ? ["pc:write"] : []),
                ...(publish ? ["pc:publish"] : []),
              ],
            })
              .then((value) => {
                setCreated((value as { token: string }).token);
                setName("");
              })
              .catch(() => {});
          }}
        >
          <label>
            {t("adminTokenName")}
            <input
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            {t("adminHours")}
            <input
              type="number"
              min={1}
              max={24}
              required
              value={hours}
              onChange={(event) => setHours(Number(event.target.value))}
            />
          </label>
          <label className="admin-checkbox">
            <input type="checkbox" checked disabled />
            {t("adminPermissionRead")}
          </label>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={write}
              onChange={(event) => setWrite(event.target.checked)}
            />
            {t("adminPermissionWrite")}
          </label>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={publish}
              onChange={(event) => setPublish(event.target.checked)}
            />
            {t("adminPermissionPublish")}
          </label>
          <button className="admin-button primary" disabled={busy || !name.trim()}>
            <Plus size={16} />
            {t("adminCreateToken")}
          </button>
        </form>
        {created && (
          <div className="admin-token-result">
            <p>{t("adminTokenOnce")}</p>
            <label>
              {t("adminEndpoint")}
              <input
                readOnly
                value={`${location.origin}/mcp`}
                onFocus={(event) => event.target.select()}
              />
            </label>
            <label>
              {t("adminToken")}
              <input readOnly value={created} onFocus={(event) => event.target.select()} />
            </label>
            <button className="admin-button" onClick={() => setCreated(null)}>
              {t("close")}
            </button>
          </div>
        )}
        {tokens.map((token) => (
          <div className="admin-token-row" key={token.id}>
            <span>
              <strong>{token.name}</strong>
              <small>
                {t("adminExpires", { date: new Date(token.expires).toLocaleString(language) })}
              </small>
              {Boolean(token.revoked) && <small>{t("adminRevoked")}</small>}
            </span>
            <button
              className="admin-button danger"
              disabled={busy || Boolean(token.revoked)}
              onClick={() => {
                void perform(`/api/admin/delegations/${token.id}`, undefined, "DELETE").catch(
                  () => {},
                );
              }}
            >
              {t("adminRevoke")}
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
function Audit({ t, run, language }: { t: T; run: Run; language: Language }) {
  const [entries, setEntries] = useState<
    | {
        sequence: number;
        occurred: string;
        subject: string;
        name?: string;
        email?: string;
        action: string;
        target: string;
        channel: string;
      }[]
    | null
  >(null);
  useEffect(() => {
    let active = true;
    void run("audit_list", { after: 0 })
      .then((value) => {
        if (active) setEntries(value as NonNullable<typeof entries>);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [run]);
  return (
    <section className="admin-card admin-audit">
      <h2>{t("adminAudit")}</h2>
      {entries?.length ? (
        <div className="admin-table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("adminAuditWhen")}</th>
                <th>{t("adminAuditAction")}</th>
                <th>{t("adminAuditTarget")}</th>
                <th>{t("adminAuditAuthor")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.sequence}>
                  <td>{new Date(entry.occurred).toLocaleString(language)}</td>
                  <td>
                    {t(
                      (`adminAction_${entry.action}` in dictionaries["pt-PT"]
                        ? `adminAction_${entry.action}`
                        : "adminAuditAction") as TextKey,
                    )}
                    <small>
                      {t(entry.channel === "mcp" ? "adminChannel_mcp" : "adminChannel_web")}
                    </small>
                  </td>
                  <td>{entry.target}</td>
                  <td>{entry.name || entry.email || entry.subject}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>{t(entries ? "adminNoAudit" : "adminLoading")}</p>
      )}
    </section>
  );
}
