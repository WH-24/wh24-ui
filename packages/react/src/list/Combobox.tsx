import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

import { Icon } from "./Icon.js";
import styles from "./Combobox.module.css";

/** Стили модуля Combobox — реэкспорт, чтобы MultiSelect (FieldEditor) мог
 *  переиспользовать те же scoped-классы меню/опций. */
export const comboStyles = styles;

export interface ComboboxOption {
  value: string; // стабильный id (department_id / position_id / …)
  label: string; // основной текст
  hint?: string | null; // вторичный текст (код), участвует в поиске
  /**
   * Аватар опции (для списков сотрудников). Если задан (в т.ч. null или пустой
   * строкой) — перед подписью рисуется кружок: фото по URL, иначе инициалы
   * (`initials`, а без них — из первых букв label). `undefined` — без кружка.
   */
  avatar?: string | null;
  initials?: string; // фолбэк-инициалы, если фото нет
  /**
   * Заголовок группы. Перед первой опцией каждой новой группы рисуется
   * разделитель — список смешанных сущностей иначе читается как одна свалка.
   * Опции одной группы должны идти подряд: группировка — по смене значения.
   */
  group?: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  /** Текст-плейсхолдер и подпись «сбросить»-опции. */
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  /** Доп. класс на корень `.combo` (например для тулбара). */
  className?: string;
  /** Доп. класс на портальное меню — чтобы стилизовать опции точечно. */
  menuClassName?: string;
  /** Инлайн-стиль корня (например ширина в тулбаре-фильтре). */
  style?: CSSProperties;
  disabled?: boolean;
  /** Значение не прошло проверку — красная рамка + aria-invalid. */
  invalid?: boolean;
  /**
   * Можно ли сбросить значение в пустое (опция-плейсхолдер в меню). true для
   * фильтров и необязательных полей; false для обязательных enum (статус и т.п.),
   * где пустого значения быть не должно. По умолчанию true.
   */
  clearable?: boolean;
  /**
   * Можно ли печатать в поле для фильтрации. false — поле только для чтения,
   * работает как обычный дропдаун (клик открывает список, поиска нет). По
   * умолчанию true. Полезно для коротких списков вроде выбора версии.
   */
  searchable?: boolean;
  /** Текст пустого меню. */
  emptyText?: string;
}

interface MenuRect {
  top: number;
  left: number;
  width: number;
  maxWidth: number;
}

/** Инициалы из ФИО для аватара-заглушки: первые буквы 1–2 слов. */
function optionInitials(label: string): string {
  const w = label
    .replace(/[«»"'()]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!w.length) return "?";
  return (w[0]![0]! + (w[1]?.[0] ?? "")).toUpperCase();
}

function OptionAvatar({ opt }: { opt: ComboboxOption }) {
  return (
    <span className={styles.avatar} aria-hidden>
      {opt.avatar ? (
        <img src={opt.avatar} alt="" loading="lazy" />
      ) : (
        opt.initials ?? optionInitials(opt.label)
      )}
    </span>
  );
}

/**
 * Combobox — выпадающий список с поиском по значению. Совместная замена
 * нативного <select>: значения грузятся из БД, набор текста фильтрует список
 * по label и hint. Выбор кладёт `value` (id) через onChange.
 *
 * Меню рендерится через портал в <body> с position:fixed и высоким z-index —
 * иначе его режет overflow:hidden/auto родителей (модалка/дроуэр) и перекрывает
 * z-index модалки. Координаты считаем от контрола и пересчитываем на scroll/resize.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "— не выбрано —",
  id,
  ariaLabel = "Открыть список",
  className,
  menuClassName,
  style,
  disabled = false,
  invalid = false,
  clearable = true,
  searchable = true,
  emptyText = "Ничего не найдено",
}: ComboboxProps) {
  const selected = options.find((o) => o.value === value) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selected?.label ?? "");
  const controlRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<MenuRect | null>(null);

  // Внешняя смена value (сброс формы, выбор отдела и т.п.) синхронизирует поле.
  useEffect(() => {
    setQuery(selected?.label ?? "");
  }, [selected?.value, selected?.label]);

  const filtered = useMemo(() => {
    // Без поиска — всегда весь список (поле только для чтения).
    if (!searchable) return options;
    const q = query.trim().toLowerCase();
    // Пока в поле — выбранное значение (пользователь ещё не начал печатать
    // новое), показываем весь список: можно просто открыть и выбрать.
    if (!q || q === (selected?.label ?? "").toLowerCase()) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.hint ?? "").toLowerCase().includes(q),
    );
  }, [options, query, selected?.label, searchable]);

  // Позиционируем портальное меню под контролом и держим в пределах вьюпорта.
  useLayoutEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    const place = () => {
      const el = controlRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const margin = 8;
      setRect({
        top: r.bottom + 4,
        left: r.left,
        width: r.width,
        maxWidth: Math.max(r.width, Math.min(520, window.innerWidth - r.left - margin)),
      });
    };
    place();
    // capture=true ловит скролл любого контейнера-предка (modal-body и т.п.).
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // Клик мимо/уход фокуса — закрыть и вернуть текст к выбранному значению.
  const closeAndReset = () => {
    window.setTimeout(() => {
      setOpen(false);
      setQuery(selected?.label ?? "");
    }, 120);
  };

  const choose = (opt: ComboboxOption | null) => {
    onChange(opt?.value ?? "");
    setQuery(opt?.label ?? "");
    setOpen(false);
  };

  const withAvatar = selected?.avatar !== undefined;

  const menu =
    open && rect
      ? createPortal(
          <div
            className={[styles.menu, menuClassName].filter(Boolean).join(" ")}
            role="listbox"
            style={{
              position: "fixed",
              top: rect.top,
              left: rect.left,
              minWidth: rect.width,
              maxWidth: rect.maxWidth,
              zIndex: 1000,
            }}
          >
            {/* Сброс показываем, только когда есть что сбрасывать: при пустом
                значении эта строка повторяла плейсхолдер и читалась как обычный
                пункт списка. */}
            {clearable && value !== "" && (
              <button
                type="button"
                className={[styles.option, styles.optionClear].join(" ")}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(null)}
              >
                {placeholder}
              </button>
            )}
            {filtered.length === 0 ? (
              <div className={styles.empty}>{emptyText}</div>
            ) : (
              filtered.map((o, i) => (
                <Fragment key={o.value}>
                  {o.group && o.group !== filtered[i - 1]?.group && (
                    <div className={styles.group}>{o.group}</div>
                  )}
                  <button
                    type="button"
                    className={styles.option}
                    role="option"
                    aria-selected={o.value === value}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o)}
                  >
                    {o.avatar !== undefined && <OptionAvatar opt={o} />}
                    <span className={styles.optionTitle}>{o.label}</span>
                    {o.hint && <span className={styles.optionCode}>{o.hint}</span>}
                  </button>
                </Fragment>
              ))
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className={[styles.combo, className].filter(Boolean).join(" ")}
      style={style}
      onBlur={disabled ? undefined : closeAndReset}
    >
      <div className={styles.control} ref={controlRef}>
        {withAvatar && selected && (
          <span className={styles.controlAvatar}>
            <OptionAvatar opt={selected} />
          </span>
        )}
        <input
          id={id}
          className={[styles.formInput, styles.input, withAvatar ? styles.inputAvatar : ""]
            .filter(Boolean)
            .join(" ")}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete={searchable ? "list" : "none"}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          readOnly={!searchable}
          value={query}
          placeholder={placeholder}
          style={!searchable ? { cursor: "pointer" } : undefined}
          onFocus={() => !disabled && setOpen(true)}
          onClick={() => !disabled && !searchable && setOpen(true)}
          onChange={(e) => {
            if (!searchable) return;
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setQuery(selected?.label ?? "");
            }
            if (e.key === "Enter" && filtered[0]) {
              e.preventDefault();
              choose(filtered[0]);
            }
          }}
        />
        <button
          className={styles.toggle}
          type="button"
          aria-label={ariaLabel}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => !disabled && setOpen((v) => !v)}
        >
          <Icon name="chevdown_sm" size={14} />
        </button>
      </div>
      {!disabled && menu}
    </div>
  );
}

export default Combobox;
