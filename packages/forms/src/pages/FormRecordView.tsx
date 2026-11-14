/**
 * FormRecordView — экран C в режиме просмотра: шапка (№ · название · статус ·
 * автор и даты · действия), тело через FormRenderer(view), «История» —
 * раскрывающаяся панель с диффом.
 *
 * С лентой (`discussion`) запись открывается в общей карточке записи
 * `RecordCard` из ui-react — той же, что у лида, проекта и ФМ: слева лента,
 * справа вкладки «Поля» и «История».
 *
 * Один и тот же компонент для полной страницы и для drawer быстрого
 * просмотра из списка: контейнер решает хост.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, RecordCard, type MenuEntry } from "@wowhaus-24/ui-react";

import type {
  Form,
  FormRecord,
  RecordHistoryEntry,
  SchemaDocument,
} from "../types.js";
import { FormRenderer } from "../render/FormRenderer.js";
import { withSystemValues } from "../render/system.js";
import { formatDateTime, type FormatContext } from "../render/format.js";
import type { RenderContext } from "../render/registry.js";
import { RecordHistory } from "./RecordHistory.js";
import {
  DEFAULT_RECORD_STATUSES,
  StatusPill,
  statusLabel,
  type StatusLabel,
} from "./StatusPill.js";
import { Banner } from "./states.js";
import styles from "./pages.module.css";

export interface FormRecordViewProps {
  form: Form;
  /** Схема ВЕРСИИ записи (record.form_version), не черновик формы. */
  schema: SchemaDocument;
  record: FormRecord;
  ctx?: RenderContext;
  statusLabels?: Record<string, StatusLabel>;
  actorName?: (id: string) => string;
  onBack?: () => void;
  backLabel?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Дополнительные действия справа в шапке. */
  actions?: ReactNode;
  /** Загрузка истории по требованию (кнопка «История»). */
  loadHistory?: () => Promise<RecordHistoryEntry[]>;
  /** Запись старше текущей версии формы — подсказать, что при правке попросят новые поля. */
  currentVersion?: number;
  /**
   * Лента записи (RecordChat). Есть — запись открывается в карточке записи
   * `RecordCard` (стандарт лида): шапка, слева лента, справа поля. Своей
   * вёрстки «как у лида» здесь нет (владелец 14.11.2026).
   */
  discussion?: ReactNode;
  /** Ссылка на задачу Pyrus, с которой сверяется запись: «Открыть в Pyrus». */
  pyrusUrl?: string;
}

/** Вкладка «История» карточки: грузится при первом открытии. */
function HistoryTab({
  load,
  schema,
  ctx,
  actorName,
}: {
  load: () => Promise<RecordHistoryEntry[]>;
  schema: SchemaDocument;
  ctx: RenderContext;
  actorName?: (id: string) => string;
}) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "open"; entries: RecordHistoryEntry[] }
    | { kind: "error" }
  >({ kind: "loading" });
  // Хост передаёт новую функцию на каждый рендер — грузим один раз.
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    let cancelled = false;
    loadRef.current().then(
      (entries) => {
        if (!cancelled) setState({ kind: "open", entries });
      },
      () => {
        if (!cancelled) setState({ kind: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div className={styles.cardTab}>
      {state.kind === "loading" && (
        <div className={styles.muted}>Загружаем историю…</div>
      )}
      {state.kind === "error" && (
        <Banner tone="bad">Не удалось загрузить историю.</Banner>
      )}
      {state.kind === "open" && (
        <RecordHistory
          entries={state.entries}
          schema={schema}
          ctx={ctx}
          actorName={actorName}
        />
      )}
    </div>
  );
}

export function FormRecordView({
  form,
  schema,
  record,
  ctx = {},
  statusLabels = DEFAULT_RECORD_STATUSES,
  actorName,
  onBack,
  backLabel,
  onEdit,
  onDelete,
  actions,
  loadHistory,
  currentVersion,
  discussion,
  pyrusUrl,
}: FormRecordViewProps) {
  const [history, setHistory] = useState<
    | { kind: "closed" }
    | { kind: "loading" }
    | { kind: "open"; entries: RecordHistoryEntry[] }
    | { kind: "error" }
  >({ kind: "closed" });
  const s = statusLabel(record.status, statusLabels);
  const who = (id: string | null) =>
    id ? (actorName ? actorName(id) : id) : "—";

  const toggleHistory = async () => {
    if (history.kind === "open" || history.kind === "loading") {
      setHistory({ kind: "closed" });
      return;
    }
    if (!loadHistory) return;
    setHistory({ kind: "loading" });
    try {
      setHistory({ kind: "open", entries: await loadHistory() });
    } catch {
      setHistory({ kind: "error" });
    }
  };

  const outdated =
    currentVersion != null && record.form_version < currentVersion;

  const body = (
    <FormRenderer
      doc={schema}
      values={withSystemValues(schema, record.data, {
        record,
        formName: form.name,
        staff: ctx.staff,
      })}
      mode="view"
      ctx={{ ...ctx, lookups: record.lookups }}
    />
  );

  const outdatedBanner = outdated && (
    <Banner>
      Запись сохранена под версией формы v{record.form_version}, текущая — v
      {currentVersion}. При редактировании попросят заполнить новые
      обязательные поля.
    </Banner>
  );

  if (discussion) {
    const menu: MenuEntry[] = onDelete
      ? [{ id: "delete", label: "Удалить", danger: true, onSelect: onDelete }]
      : [];
    const created = `${who(record.created_by)}, ${formatDateTime(record.created_at)}`;
    return (
      <RecordCard
        crumbs={[
          { label: backLabel ?? form.nav_label ?? form.name, onClick: onBack },
          { label: "Запись" },
        ]}
        title={record.title || "Без названия"}
        idLabel={`№${record.number}`}
        kpis={[
          { label: "Статус", value: s.label },
          { label: "Создал", value: created },
          ...(record.updated_at !== record.created_at
            ? [
                {
                  label: "Изменено",
                  value: `${formatDateTime(record.updated_at)}${
                    record.updated_by ? `, ${who(record.updated_by)}` : ""
                  }`,
                },
              ]
            : []),
          { label: "Версия формы", value: `v${record.form_version}` },
        ]}
        pyrusUrl={pyrusUrl}
        headerAside={actions}
        menu={menu}
        notice={outdatedBanner || undefined}
        left={{
          label: "Обсуждение",
          bare: true,
          tabs: [{ id: "feed", label: "Обсуждение" }],
          selfScroll: ["feed"],
          render: () => (
            <div className={styles.cardFeed} data-record-feed="">
              {discussion}
            </div>
          ),
        }}
        right={{
          label: "Поля",
          tabs: [
            { id: "fields", label: "Поля" },
            ...(loadHistory ? [{ id: "history", label: "История" }] : []),
          ],
          keepMounted: ["fields"],
          headAside: (tab) =>
            tab === "fields" && onEdit && form.status === "published" ? (
              <button
                type="button"
                className={["btn", "btn-primary", "btn-sm", styles.cardEdit].join(" ")}
                onClick={onEdit}
              >
                <Icon name="edit" size={14} /> Редактировать
              </button>
            ) : null,
          render: (tab) =>
            tab === "history" && loadHistory ? (
              <HistoryTab
                load={loadHistory}
                schema={schema}
                ctx={ctx}
                actorName={actorName}
              />
            ) : (
              <div className={styles.cardTab}>{body}</div>
            ),
        }}
      />
    );
  }

  const fields = (
    <div className={styles.recFields}>
      {history.kind === "loading" && (
        <div className={styles.muted}>Загружаем историю…</div>
      )}
      {history.kind === "error" && (
        <Banner tone="bad">Не удалось загрузить историю.</Banner>
      )}
      {history.kind === "open" && (
        <RecordHistory
          entries={history.entries}
          schema={schema}
          ctx={ctx}
          actorName={actorName}
        />
      )}
      {body}
    </div>
  );

  return (
    <div
      className={[styles.page, styles.record].join(" ")}
    >
      {onBack && (
        <div>
          <button
            type="button"
            className={["btn", "btn-ghost", "btn-sm", styles.back].join(" ")}
            onClick={onBack}
          >
            <Icon name="back" size={14} />
            {backLabel ?? form.nav_label ?? form.name}
          </button>
        </div>
      )}
      <div className={styles.recHead}>
        <div className={styles.recNum} aria-label={`Запись № ${record.number}`}>
          №{record.number}
        </div>
        <div className={styles.recTitleWrap}>
          <div className={styles.recTitleRow}>
            <h1 className={styles.recTitle} title={record.title}>
              {record.title || (
                <span className={styles.muted}>Без названия</span>
              )}
            </h1>
            <StatusPill tone={s.tone}>{s.label}</StatusPill>
          </div>
          <div className={styles.recMeta}>
            <span>Создал {who(record.created_by)}</span>
            <span>·</span>
            <span>{formatDateTime(record.created_at)}</span>
            {record.updated_at !== record.created_at && (
              <>
                <span>·</span>
                <span>
                  изменено {formatDateTime(record.updated_at)}
                  {record.updated_by ? `, ${who(record.updated_by)}` : ""}
                </span>
              </>
            )}
            <span>·</span>
            <span>v{record.form_version}</span>
          </div>
        </div>
        <div className={styles.actions}>
          {actions}
          {pyrusUrl && (
            <a
              className="btn btn-ghost btn-sm"
              href={pyrusUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="external" size={14} /> Открыть в Pyrus
            </a>
          )}
          {loadHistory && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-expanded={history.kind === "open"}
              onClick={toggleHistory}
            >
              <Icon name="list" size={14} /> История
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onDelete}
            >
              <Icon name="trash" size={14} /> Удалить
            </button>
          )}
          {onEdit && form.status === "published" && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onEdit}
            >
              <Icon name="edit" size={14} /> Редактировать
            </button>
          )}
        </div>
      </div>

      {outdatedBanner}

      {fields}
    </div>
  );
}
