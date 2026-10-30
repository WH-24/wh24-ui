import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";

import { Icon, type IconName } from "./Icon.js";
import { FilterBar } from "./filter/FilterBar.js";
import { useFilterState } from "./filter/useFilterState.js";
import { matchItem } from "./filter/matchItem.js";
import type { FilterBarConfig, FilterSettingsProvider } from "./filter/types.js";
import styles from "./ListPage.module.css";

/** Описание колонки списка: что в заголовке, как рендерить ячейку, как сортировать. */
export interface ListColumn<T> {
  /** Уникальный ключ (он же ключ сортировки). */
  key: string;
  label: string;
  /** Ширина в colgroup (число = px, строка = как есть, напр. "28%"). */
  width?: string | number;
  /** Класс для <td> (например "mono"). */
  className?: string;
  /** Содержимое ячейки. */
  render: (row: T) => ReactNode;
  /** Значение для сортировки. Есть → колонка сортируемая. */
  sortValue?: (row: T) => string;
  /**
   * Колонка есть в списке настройки, но по умолчанию выключена. Нужно, когда
   * колонок много (все поля сущности + пользовательские доп-поля): показывать
   * их все сразу — сломать таблицу.
   *
   * Применяется только к НОВЫМ для пользователя колонкам: однажды принятое им
   * решение по колонке не переигрывается (см. `known` в localStorage).
   */
  defaultHidden?: boolean;
  /**
   * Минимальная ширина в px. Из суммы минимумов видимых колонок считается
   * min-width таблицы: пока колонок мало — работает `width` (проценты), когда
   * перестают помещаться — таблица растёт и появляется горизонтальная
   * прокрутка, вместо того чтобы сплющивать колонки в нечитаемые полоски.
   */
  minWidth?: number;
  /**
   * Колонка с названием сущности — та, по которой строку узнают. Ей достаётся
   * повышенный минимум (NAME_COL_MIN_WIDTH), потому что в ней, кроме самого
   * названия, обычно стоят миниатюра, бейджи и вторая строка (почта, тип): на
   * общих 150px название обрезалось многоточием, хотя соседние «Год» и «Город»
   * стояли свободно. Задавать вместе с minWidth незачем — явное значение
   * сильнее флага.
   */
  primary?: boolean;
}

/** Минимум на колонку, если не задан явно. */
const DEFAULT_COL_MIN_WIDTH = 150;
/**
 * Минимум для колонки названия (primary) — в неё смотрят в первую очередь.
 * Экспортируется: списки, которые задают минимумы всем колонкам вручную,
 * сравнивают остальные колонки с этим числом, а не со своей копией.
 */
export const NAME_COL_MIN_WIDTH = 350;
/** Служебная колонка справа (шестерёнка настройки). */
const ACTIONS_COL_WIDTH = 44;

/** Минимальная ширина колонки в px: явная, либо width в px, либо дефолт. */
function colMinWidth<T>(c: ListColumn<T>): number {
  if (c.minWidth != null) return c.minWidth;
  if (typeof c.width === "number") return c.width;
  return c.primary ? NAME_COL_MIN_WIDTH : DEFAULT_COL_MIN_WIDTH;
}

/** Процент из width колонки ("34%" → 34); не процент — null. */
function widthPercent<T>(c: ListColumn<T>): number | null {
  if (typeof c.width !== "string" || !c.width.trim().endsWith("%")) return null;
  const pct = Number.parseFloat(c.width);
  return Number.isFinite(pct) ? pct : null;
}

/**
 * Пора ли раздать колонкам px-минимумы вместо процентов из `width`.
 *
 * Да в двух случаях. Первый — сумма минимумов не влезает в контейнер: проценты
 * там дают нечитаемые полоски, а так таблица растёт и уезжает в горизонтальную
 * прокрутку. Второй — процент колонки названия не дотягивает до её минимума:
 * 34% на контейнере 990px — это ~330px, и название обрезается многоточием.
 * Поставить `max(34%, 350px)` в colgroup не выходит: при table-layout:fixed
 * браузер нормализует ширины и всё равно сжимает колонку. Зато в px-режиме
 * лишнее место (когда минимумы суммарно уже контейнера) браузер раскладывает по
 * колонкам сам — таблица занимает всю ширину и без процентов.
 */
export function needsPxWidths<T>(
  cols: ListColumn<T>[],
  wrapWidth: number,
  tableMinWidth: number,
): boolean {
  if (wrapWidth <= 0) return false;
  if (tableMinWidth > wrapWidth) return true;
  return cols.some((c) => {
    if (!c.primary) return false;
    const pct = widthPercent(c);
    return pct != null && (wrapWidth * pct) / 100 < colMinWidth(c);
  });
}

/**
 * Ширины для colgroup. В px-режиме — минимумы колонок. В процентном — `width`
 * как есть, но если проценты видимых колонок в сумме меньше 100% (часть колонок
 * скрыта), колонка названия остаётся без ширины и забирает остаток. Иначе
 * при table-layout:fixed браузер раздавал лишнее всем колонкам, и узкая
 * px-колонка (аватар 56px) расползалась на полтаблицы.
 */
export function colgroupWidths<T>(
  cols: ListColumn<T>[],
  pxWidths: boolean,
): (string | number | undefined)[] {
  if (pxWidths) return cols.map((c) => colMinWidth(c));
  const pctTotal = cols.reduce((sum, c) => sum + (widthPercent(c) ?? 0), 0);
  const fill = pctTotal < 100 && cols.some((c) => c.primary);
  return cols.map((c) => (fill && c.primary ? undefined : c.width));
}

/** Сохранённая настройка колонок. */
interface ColsPrefs {
  /** Выключенные пользователем (или скрытые по умолчанию) колонки. */
  hidden: string[];
  /**
   * Колонки, которые пользователь уже видел в меню. Без этого списка колонка,
   * добавленная позже (напр. новое доп-поле), не смогла бы прийти скрытой:
   * её просто нет в hidden — и она бы вылезла в таблицу у всех.
   */
  known: string[];
  /**
   * Пользователь сам настроил колонки (нажал «Применить»). Отличать это от
   * «мы просто запомнили состав колонок при заходе» обязательно: иначе общая
   * настройка «для всех» переставала бы действовать после первого же визита.
   */
  own?: boolean;
}

/** Настроил ли пользователь колонки сам (а не просто открывал список). */
function hasOwnStoredCols(key: string): boolean {
  try {
    return parseColsPrefs(localStorage.getItem(key)).own === true;
  } catch {
    return false;
  }
}

// Старый формат — просто массив скрытых ключей.
function parseColsPrefs(raw: string | null): ColsPrefs {
  if (!raw) return { hidden: [], known: [] };
  try {
    const v = JSON.parse(raw) as string[] | ColsPrefs;
    // Старый формат (просто массив) — это была ручная настройка пользователя.
    if (Array.isArray(v)) return { hidden: v, known: v, own: true };
    return {
      hidden: v.hidden ?? [],
      known: v.known ?? [],
      own: v.own === true,
    };
  } catch {
    return { hidden: [], known: [] };
  }
}

interface SortState {
  key: string;
  dir: "asc" | "desc";
}

/** Режимы показа списка. 'cards' и 'board' доступны, только если заданы. */
export type ListView = "list" | "cards" | "board";

/** Папка списка. Порядок в `ListGroups.items` — порядок показа. */
export interface ListGroup {
  key: string;
  label: string;
}

/**
 * Папки — как в файловом менеджере. В корне таблица показывает строки-папки
 * (иконка, имя, сводка в колонках) и строки без папки; клик по папке открывает
 * её — видны только её строки, сверху «крошки» для возврата. В карточках то же:
 * плитки-папки, внутри — карточки папки. Пока активен фильтр или поиск, корень
 * показывает найденное во всех папках сразу, плоским списком.
 */
export interface ListGroups<T> {
  items: ListGroup[];
  get: (row: T) => string;
  /** Кнопки папки (меню «Переименовать / Удалить») — в строке, плитке и крошках. */
  renderActions?: (group: ListGroup, count: number) => ReactNode;
  /**
   * Перенос строки в папку перетаскиванием на строку или плитку папки. Не
   * задан — строки не перетаскиваются. Зовётся, только если папка сменилась.
   */
  onMove?: (row: T, groupKey: string) => void;
  /**
   * Ячейки строки-папки по ключу колонки («3 слайда» под «Размером», дата).
   * Первую видимую колонку — значок и имя — рисует ListPage.
   */
  folderCells?: (group: ListGroup, rows: T[]) => Partial<Record<string, ReactNode>>;
  /** Подпись под именем плитки-папки. По умолчанию — число строк. */
  describe?: (group: ListGroup, rows: T[]) => ReactNode;
  /** Корень в крошках. По умолчанию — заголовок страницы. */
  rootLabel?: string;
  /** Открыли папку (key) или вернулись в корень (null). */
  onOpenChange?: (key: string | null) => void;
}

const DRAG_TYPE = "application/x-wh24-list-row";

/**
 * Что показать на текущем уровне. `open` — открытая папка (null — корень),
 * `searching` — активен фильтр/поиск: тогда в корне плоский список найденного.
 * Строки с ключом не из `items` живут в корне, без папки.
 */
export function folderView<T>(
  rows: T[],
  groups: ListGroups<T>,
  open: string | null,
  searching: boolean,
): { folders: { group: ListGroup; rows: T[] }[]; rows: T[] } {
  if (open !== null) {
    return { folders: [], rows: rows.filter((r) => groups.get(r) === open) };
  }
  if (searching) return { folders: [], rows };
  const known = new Set(groups.items.map((g) => g.key));
  const buckets = new Map<string, T[]>(groups.items.map((g) => [g.key, []]));
  const loose: T[] = [];
  for (const r of rows) {
    const k = groups.get(r);
    if (known.has(k)) buckets.get(k)!.push(r);
    else loose.push(r);
  }
  return {
    folders: groups.items.map((g) => ({ group: g, rows: buckets.get(g.key)! })),
    rows: loose,
  };
}

export interface ListPageProps<T> {
  // Шапка.
  title: string;
  subtitle?: string;
  // Данные.
  data: T[];
  getId: (row: T) => string;
  columns: ListColumn<T>[];

  // Универсальный фильтр (Bitrix24-style) — обязателен (ядро страницы-списка).
  filterConfig: FilterBarConfig<T>;
  /** Источник глобальных пресетов (бэкенд модуля). */
  filterSettings?: FilterSettingsProvider;
  /** Админ модуля — может править набор полей и глобальные пресеты. */
  canEditFields?: boolean;
  /** Внешний поиск (например из топбара). */
  externalSearch?: string;

  // Поведение.
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  pageSize?: number;
  defaultSort?: SortState;

  // Карточный вид (если задан — появляется переключатель видов).
  renderCard?: (row: T) => ReactNode;
  /**
   * Доска (канбан): вид, который сам решает, как разложить строки — по
   * колонкам статуса, стадии и т.п. Получает УЖЕ отфильтрованные и
   * отсортированные строки целиком, без пагинации: доска теряет смысл, если
   * половина карточек осталась на второй странице.
   *
   * ListPage про раскладку ничего не знает — только даёт ей место и общий
   * тулбар, чтобы фильтр, поиск и кнопки были те же, что у таблицы.
   */
  renderBoard?: (rows: T[]) => ReactNode;
  /**
   * Стартовый режим показа. По умолчанию таблица; для списков, где важнее
   * визуал (превью, обложки), потребитель ставит 'cards'. Выбор пользователя
   * запоминается (localStorage по scope фильтра) и перекрывает это значение.
   * Недоступный вид (не задан его рендерер) откатывается к таблице.
   */
  defaultView?: ListView;

  // Пустое состояние.
  emptyTitle?: string;
  emptyIcon?: IconName;

  // Слоты тулбара.
  /** Кнопки слева от фильтра (Добавить, Экспорт…). Получает отфильтрованные строки. */
  toolbarStart?: (ctx: { filtered: T[] }) => ReactNode;
  /** Кнопки справа, после переключателя вида (настройки вида — «шестерёнка»).
   *  Получает текущий вид: настройки доски показывают только на доске. */
  toolbarEnd?: (ctx: { viewMode: ListView }) => ReactNode;
  /** Действия при выделении строк (массовое удаление…). */
  selectionActions?: (ctx: { selected: T[]; clear: () => void }) => ReactNode;

  /**
   * Папки (см. ListGroups): строки-папки и вход в папку, как в Диске. С ними
   * текущий уровень показывается целиком, без постраничности.
   */
  groups?: ListGroups<T>;
}

/**
 * Универсальная страница-список: шапка со счётчиком, тулбар (фильтр + слоты),
 * сортируемая таблица с выбором, карточный вид, пагинация. Config-driven и
 * generic по T — модуль задаёт только колонки, конфиг фильтра и слоты.
 */
export function ListPage<T>({
  title,
  subtitle,
  data,
  getId,
  columns,
  filterConfig,
  filterSettings,
  canEditFields,
  externalSearch = "",
  onRowClick,
  selectable = false,
  pageSize = 20,
  defaultSort,
  renderCard,
  renderBoard,
  defaultView = "list",
  emptyTitle = "Ничего не найдено",
  emptyIcon = "search",
  toolbarStart,
  toolbarEnd,
  selectionActions,
  groups,
}: ListPageProps<T>) {
  const {
    state: filter,
    setState: setFilter,
    fields: filterFields,
    setFields: setFilterFields,
  } = useFilterState(filterConfig);
  const [sort, setSort] = useState<SortState>(
    defaultSort ?? { key: columns[0]?.key ?? "", dir: "asc" },
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Режим показа: сохранённый выбор пользователя (по scope) важнее defaultView.
  // Переключатель есть только там, где кроме таблицы задан хоть один вид.
  const hasCards = Boolean(renderCard);
  const hasBoard = Boolean(renderBoard);
  const viewKey = `wh24:list-view:${filterConfig.scope}`;
  const viewAvailable = useCallback(
    (v: string): v is ListView =>
      v === "list" || (v === "cards" && hasCards) || (v === "board" && hasBoard),
    [hasCards, hasBoard],
  );
  const [viewMode, setViewMode] = useState<ListView>(() => {
    try {
      const saved = localStorage.getItem(viewKey);
      if (saved !== null && viewAvailable(saved)) return saved;
    } catch {
      /* приватный режим — просто берём defaultView */
    }
    return viewAvailable(defaultView) ? defaultView : "list";
  });
  // Вид мог исчезнуть у потребителя между релизами (убрали карточки, доску) —
  // сохранённый выбор тогда оставил бы пустой экран.
  useEffect(() => {
    if (!viewAvailable(viewMode)) setViewMode("list");
  }, [viewMode, viewAvailable]);
  useEffect(() => {
    if (!hasCards && !hasBoard) return;
    try {
      localStorage.setItem(viewKey, viewMode);
    } catch {
      /* приватный режим — выбор не сохранится, UI работает */
    }
  }, [viewMode, viewKey, hasCards, hasBoard]);
  // Ни карточки, ни таблица не листаются постранично: показываем растущий срез
  // и догружаем очередную порцию, когда низ списка появляется в зоне
  // видимости. Таблица — так же с 30.10.2026 (владелец: «убрать и сделать
  // прокрутку»). Размер порции = pageSize.
  const [shown, setShown] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Папки ─────────────────────────────────────────────────────────────────
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openFolder = (key: string | null) => {
    setOpenKey(key);
    groups?.onOpenChange?.(key);
  };
  // Открытую папку удалили (или у роли её больше нет) — возвращаемся в корень.
  const openGroup = groups?.items.find((g) => g.key === openKey) ?? null;
  useEffect(() => {
    if (openKey !== null && groups && !openGroup) {
      setOpenKey(null);
      groups.onOpenChange?.(null);
    }
  }, [openKey, openGroup, groups]);
  // Папка, над которой сейчас тащат строку, — для подсветки.
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // Тащат строку: показываем ленту папок, куда её можно бросить (в открытой
  // папке и в результатах поиска других папок на экране нет).
  const [dragging, setDragging] = useState<{ from: string } | null>(null);

  // ── Настройка колонок (шестерёнка в конце шапки) ──────────────────────────
  // Скрытые колонки запоминаются per-user в localStorage по scope фильтра.
  const colsKey = `wh24:list-cols:${filterConfig.scope}`;
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    let prefs: ColsPrefs = { hidden: [], known: [] };
    try {
      prefs = parseColsPrefs(localStorage.getItem(colsKey));
    } catch {
      /* приватный режим — настройка не сохранится, но UI работает */
    }
    const hidden = new Set(prefs.hidden);
    // Новая для пользователя колонка с defaultHidden приходит выключенной.
    // known уважаем только при own=true: без явного «Применить» список known —
    // просто «что уже показывали», и он не должен отменять defaultHidden
    // (иначе колонка, однажды утёкшая в таблицу, остаётся там навсегда).
    const known = new Set(prefs.own ? prefs.known : []);
    for (const c of columns) {
      if (c.defaultHidden && !known.has(c.key)) hidden.add(c.key);
    }
    return hidden;
  });
  // Колонки из асинхронных источников (справочники, доп-поля) появляются ПОСЛЕ
  // маунта — initializer выше их не видел. Новые для пользователя defaultHidden-
  // колонки скрываем и здесь, иначе они вылезают в таблицу сами по себе.
  useEffect(() => {
    let known: Set<string>;
    try {
      const prefs = parseColsPrefs(localStorage.getItem(colsKey));
      known = new Set(prefs.own ? prefs.known : []);
    } catch {
      known = new Set();
    }
    setHiddenCols((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const c of columns) {
        if (c.defaultHidden && !known.has(c.key) && !next.has(c.key)) {
          next.add(c.key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [columns, colsKey]);
  const [colsOpen, setColsOpen] = useState(false);
  // Черновик: галочки в окне применяются только по кнопке «Применить».
  const [draftHidden, setDraftHidden] = useState<Set<string>>(new Set());
  const [colsQuery, setColsQuery] = useState("");
  // «Для всех» — сохранить набор колонок как общий (доступно админу модуля).
  const [colsForAll, setColsForAll] = useState(false);
  // У пользователя уже есть своя настройка → общая на него не действует.
  const hasOwnCols = useRef(hasOwnStoredCols(colsKey));
  const gearRef = useRef<HTMLButtonElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Переключать можно только именованные колонки (у служебных, напр. аватара,
  // label пустой — они всегда видимы).
  const toggleableCols = useMemo(() => columns.filter((c) => c.label.trim() !== ""), [columns]);
  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenCols.has(c.key)),
    [columns, hiddenCols],
  );

  // Пока сумма минимумов меньше контейнера — таблица занимает 100% и раскладка
  // прежняя (проценты в width). Как только колонок становится много, таблица
  // растёт до этой ширины, и .tableWrap прокручивается по горизонтали.
  const tableMinWidth = useMemo(
    () => visibleColumns.reduce((sum, c) => sum + colMinWidth(c), ACTIONS_COL_WIDTH),
    [visibleColumns],
  );

  // Ширина области таблицы — чтобы понять, помещаются ли колонки.
  const wrapRef = useRef<HTMLDivElement>(null);
  // Липкая горизонтальная полоса: настоящая полоса .tableWrap стоит под
  // таблицей, то есть в КОНЦЕ СТРАНИЦЫ. На списке в двести строк до неё надо
  // долистать донизу, а потом вернуться к нужной строке — поэтому рядом живёт
  // вторая, прижатая к нижнему краю экрана, и обе двигают друг друга.
  const hScrollRef = useRef<HTMLDivElement>(null);
  const [hOverflow, setHOverflow] = useState(false);
  const [wrapWidth, setWrapWidth] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    setWrapWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w != null) setWrapWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode]);

  // Полоса нужна, только когда таблица шире контейнера; прокрутки синхронны в
  // обе стороны. Флаг lock — от петли «скролл → скролл».
  useEffect(() => {
    const wrap = wrapRef.current;
    const bar = hScrollRef.current;
    if (!wrap || !bar) return;
    const measure = () => setHOverflow(wrap.scrollWidth - wrap.clientWidth > 1);
    measure();
    let lock = false;
    const fromWrap = () => {
      if (lock) return;
      lock = true;
      bar.scrollLeft = wrap.scrollLeft;
      lock = false;
      measure();
    };
    const fromBar = () => {
      if (lock) return;
      lock = true;
      wrap.scrollLeft = bar.scrollLeft;
      lock = false;
    };
    wrap.addEventListener("scroll", fromWrap, { passive: true });
    bar.addEventListener("scroll", fromBar, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(wrap);
    return () => {
      wrap.removeEventListener("scroll", fromWrap);
      bar.removeEventListener("scroll", fromBar);
      ro?.disconnect();
    };
  }, [tableMinWidth, viewMode]);

  // Проценты в width рассчитаны на несколько колонок и в сумме дают сильно
  // больше 100% — при table-layout:fixed они съедают всю ширину, а колонки без
  // явной width схлопываются в ноль. Условия перехода на px — в needsPxWidths.
  const pxWidths = needsPxWidths(visibleColumns, wrapWidth, tableMinWidth);
  const colWidths = colgroupWidths(visibleColumns, pxWidths);

  // Пишем и hidden, и known (все текущие колонки): иначе колонка, добавленная
  // позже, не отличалась бы от «пользователь её включил».
  const persistCols = useCallback(
    (hidden: Set<string>, own = hasOwnCols.current) => {
      try {
        const prefs: ColsPrefs = {
          hidden: [...hidden],
          known: columns.map((c) => c.key),
          own,
        };
        localStorage.setItem(colsKey, JSON.stringify(prefs));
      } catch {
        /* приватный режим — настройка не сохранится, но UI работает */
      }
    },
    [colsKey, columns],
  );

  // Общий набор колонок («для всех»), сохранённый админом модуля. Действует
  // только на тех, у кого нет своей настройки.
  useEffect(() => {
    if (!filterSettings || hasOwnCols.current) return;
    let alive = true;
    void filterSettings
      .load(filterConfig.scope)
      .then((s) => {
        // Пустой список — это авто-созданная запись «настройки нет», а не
        // «админ велел показать все колонки»: не затираем дефолтные скрытия.
        if (!alive || !s.columns || s.columns.length === 0) return;
        setHiddenCols(new Set(s.columns));
      })
      .catch(() => {
        /* нет общей настройки — остаются дефолты колонок */
      });
    return () => {
      alive = false;
    };
  }, [filterSettings, filterConfig.scope]);

  // Запоминаем показанный пользователю набор колонок, даже если он ничего не
  // трогал: иначе новое доп-поле каждый раз считалось бы «новым».
  useEffect(() => {
    persistCols(hiddenCols);
  }, [persistCols, hiddenCols]);

  const colsTitle = `Настройка списка «${title}»`;

  const openCols = () => {
    setDraftHidden(new Set(hiddenCols));
    setColsQuery("");
    setColsForAll(false);
    setColsOpen(true);
  };
  const closeCols = () => setColsOpen(false);

  // Поиск по названию поля — при полусотне колонок листать глазами уже тяжело.
  const shownCols = useMemo(() => {
    const q = colsQuery.trim().toLowerCase();
    return q ? toggleableCols.filter((c) => c.label.toLowerCase().includes(q)) : toggleableCols;
  }, [toggleableCols, colsQuery]);

  const draftVisibleCount = toggleableCols.filter((c) => !draftHidden.has(c.key)).length;

  const toggleDraft = (key: string) =>
    setDraftHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // «Выбрать все» действует на то, что сейчас в списке (с учётом поиска).
  const toggleAllDraft = () => {
    const allOn = draftVisibleCount === toggleableCols.length;
    setDraftHidden((prev) => {
      const next = new Set(prev);
      if (allOn) {
        // Снимаем всё, кроме первой — пустая таблица бессмысленна.
        toggleableCols.forEach((c, i) => (i === 0 ? next.delete(c.key) : next.add(c.key)));
      } else {
        toggleableCols.forEach((c) => next.delete(c.key));
      }
      return next;
    });
  };

  // «По умолчанию» — вернуть набор, заданный модулем (defaultHidden).
  const resetCols = () =>
    setDraftHidden(new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)));

  const applyCols = () => {
    setHiddenCols(new Set(draftHidden));
    // Явный выбор пользователя: с этого момента общая настройка его не трогает.
    hasOwnCols.current = true;
    persistCols(draftHidden, true);

    // «Для всех» — тот же набор становится общим. Пресеты и поля фильтра
    // перечитываем и кладём обратно как есть, чтобы не затереть их.
    if (colsForAll && filterSettings) {
      const scope = filterConfig.scope;
      void filterSettings
        .load(scope)
        .then((cur) => filterSettings.save(scope, { ...cur, columns: [...draftHidden] }))
        .catch(() => {
          /* сохранение общей настройки не должно ломать личную */
        });
    }
    setColsOpen(false);
  };

  // Промежуточное состояние «выбрать все», когда включена только часть.
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        draftVisibleCount > 0 && draftVisibleCount < toggleableCols.length;
    }
  }, [draftVisibleCount, toggleableCols.length, colsOpen]);

  const colByKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns]);

  const filtered = useMemo(() => {
    let list = data.filter((r) => matchItem(r, filter, filterConfig));
    const ext = externalSearch.trim().toLowerCase();
    if (ext && filterConfig.search) {
      list = list.filter((r) => filterConfig.search!.get(r).toLowerCase().includes(ext));
    }
    const col = colByKey.get(sort.key);
    if (col?.sortValue) {
      list = [...list].sort((a, b) => {
        const av = col.sortValue!(a);
        const bv = col.sortValue!(b);
        return (av > bv ? 1 : av < bv ? -1 : 0) * (sort.dir === "asc" ? 1 : -1);
      });
    }
    return list;
  }, [data, filter, filterConfig, externalSearch, sort, colByKey]);

  // Срез от начала до shown — и для карточек, и для таблицы. Меняется состав (фильтр/сортировка/
  // сами данные) — начинаем показ заново с первой порции.
  const visible = filtered.slice(0, shown);
  const hasMore = shown < filtered.length;
  useEffect(() => {
    setShown(pageSize);
  }, [filtered, pageSize]);
  // Догрузка по появлению сентинела в зоне видимости. IntersectionObserver
  // подхватывает и «низ уже виден» (мало карточек), и обычный скролл.
  //
  // shown в зависимостях НАМЕРЕННО: observer срабатывает только на смену
  // видимости, а после подгрузки сентинел часто остаётся в кадре (короткий
  // список, большой rootMargin) и второй раз не триггерит — показ застревал на
  // второй порции. Пересоздаём observer после каждой подгрузки: `observe()`
  // сразу зовёт колбэк, если сентинел всё ещё виден, и грузим дальше — пока он
  // не уйдёт за пределы rootMargin или не покажем всё.
  useEffect(() => {
    if (viewMode === "board" || !hasMore) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown((n) => Math.min(n + pageSize, filtered.length));
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [viewMode, hasMore, pageSize, filtered.length, shown]);

  const searching = filtered.length < data.length;
  const level = useMemo(
    () => (groups ? folderView(filtered, groups, openGroup?.key ?? null, searching) : null),
    [groups, filtered, openGroup, searching],
  );
  const canDrag = Boolean(groups?.onMove);
  const rowById = useMemo(() => new Map(data.map((r) => [getId(r), r])), [data, getId]);

  const dragProps = (row: T) =>
    canDrag
      ? {
          draggable: true,
          onDragStart: (e: DragEvent) => {
            e.dataTransfer.setData(DRAG_TYPE, getId(row));
            e.dataTransfer.effectAllowed = "move";
            setDragging({ from: groups!.get(row) });
          },
          onDragEnd: () => {
            setDropTarget(null);
            setDragging(null);
          },
        }
      : {};

  // Зона сброса — строка или плитка папки.
  const dropProps = (key: string) =>
    canDrag
      ? {
          "data-drop": dropTarget === key ? "true" : undefined,
          onDragOver: (e: DragEvent) => {
            if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (dropTarget !== key) setDropTarget(key);
          },
          onDragLeave: (e: DragEvent) => {
            const next = e.relatedTarget as Node | null;
            if (!next || !e.currentTarget.contains(next)) setDropTarget(null);
          },
          onDrop: (e: DragEvent) => {
            e.preventDefault();
            setDropTarget(null);
            setDragging(null);
            const row = rowById.get(e.dataTransfer.getData(DRAG_TYPE));
            if (row && groups!.get(row) !== key) groups!.onMove!(row, key);
          },
        }
      : {};

  const folderActions = (g: ListGroup, count: number) =>
    groups?.renderActions ? (
      <span className={styles.folderActions} onClick={(e) => e.stopPropagation()}>
        {groups.renderActions(g, count)}
      </span>
    ) : null;

  const folderRow = (g: ListGroup, rows: T[]) => {
    const cells = groups?.folderCells?.(g, rows) ?? {};
    return (
      <tr
        key={`folder:${g.key}`}
        className={styles.folderRow}
        {...dropProps(g.key)}
        onClick={() => openFolder(g.key)}
      >
        <td className={styles.colGear} />
        {visibleColumns.map((c, i) => (
          <td key={c.key} className={c.className}>
            {i === 0 ? (
              <span className={styles.folderName}>
                <span className={styles.folderIcon}>
                  <Icon name="folder" size={18} />
                </span>
                <button
                  type="button"
                  className={styles.folderOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    openFolder(g.key);
                  }}
                >
                  {g.label}
                </button>
                {folderActions(g, rows.length)}
              </span>
            ) : (
              (cells[c.key] ?? null)
            )}
          </td>
        ))}
      </tr>
    );
  };

  const folderTile = (g: ListGroup, rows: T[]) => (
    <div
      key={`folder:${g.key}`}
      className={styles.folderTile}
      role="button"
      tabIndex={0}
      aria-label={`Открыть папку «${g.label}»`}
      {...dropProps(g.key)}
      onClick={() => openFolder(g.key)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openFolder(g.key);
        }
      }}
    >
      <span className={styles.folderIcon}>
        <Icon name="folder" size={22} />
      </span>
      <span className={styles.folderTileText}>
        <span className={styles.folderTileName}>{g.label}</span>
        <span className={styles.folderTileMeta}>
          {groups?.describe ? groups.describe(g, rows) : rows.length}
        </span>
      </span>
      {folderActions(g, rows.length)}
    </div>
  );

  // Лента «Переложить в:» — пока тащат строку там, где папок не видно.
  const dropBar = dragging && level && level.folders.length === 0 && groups && (
    <div className={styles.dropBar}>
      <span className={styles.dropBarLabel}>Переложить в:</span>
      {groups.items
        .filter((g) => g.key !== dragging.from)
        .map((g) => (
          <span key={g.key} className={styles.dropChip} {...dropProps(g.key)}>
            <Icon name="folder" size={14} />
            {g.label}
          </span>
        ))}
    </div>
  );

  const crumbs = openGroup && (
    <div className={styles.crumbs}>
      <button type="button" className={styles.crumbRoot} onClick={() => openFolder(null)}>
        <Icon name="back" size={14} />
        {groups?.rootLabel ?? title}
      </button>
      <span className={styles.crumbSep}>›</span>
      <span className={styles.crumbCurrent}>
        <Icon name="folder" size={14} />
        {openGroup.label}
      </span>
      {folderActions(openGroup, level?.rows.length ?? 0)}
    </div>
  );

  const renderRow = (row: T) => {
    const id = getId(row);
    return (
      <tr
        key={id}
        {...dragProps(row)}
        data-selected={selectable ? String(selected.has(id)) : undefined}
        onClick={onRowClick ? () => onRowClick(row) : undefined}
      >
        <td className={styles.colGear} />
        {visibleColumns.map((c, i) => {
          // В первой ячейке — чекбокс выбора (виден при наведении/выборе),
          // отдельной колонки чекбоксов нет.
          const host = selectable && i === 0;
          return (
            <td
              key={c.key}
              className={[c.className, host ? styles.colSelectHost : ""].filter(Boolean).join(" ")}
            >
              {host && (
                <span className={styles.cellSelectBox} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(id)}
                    onChange={() => toggleSelect(id)}
                    aria-label="Выбрать строку"
                  />
                </span>
              )}
              {c.render(row)}
            </td>
          );
        })}
      </tr>
    );
  };

  const toggleSort = (k: string) => {
    setSort((s) =>
      s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" },
    );
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const clearSelection = () => setSelected(new Set());
  const selectedRows = useMemo(
    () => filtered.filter((r) => selected.has(getId(r))),
    [filtered, selected, getId],
  );

  // +1 — служебная колонка с шестерёнкой в конце шапки.
  const colSpan = visibleColumns.length + 1 + (selectable ? 1 : 0);

  const empty = (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <Icon name={emptyIcon} size={20} />
      </div>
      <div className={styles.emptyTitle}>{emptyTitle}</div>
      <div className={styles.emptyDesc}>Попробуйте изменить фильтры.</div>
    </div>
  );

  const folderEmpty = (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <Icon name="folder" size={20} />
      </div>
      <div className={styles.emptyTitle}>Папка пуста</div>
      {canDrag && (
        <div className={styles.emptyDesc}>
          Перетащите сюда строку из другой папки или переложите через меню.
        </div>
      )}
    </div>
  );
  // Пустой уровень: в открытой папке без поиска — «Папка пуста», иначе общий.
  const levelEmpty =
    level && level.folders.length === 0 && level.rows.length === 0
      ? openGroup && !searching
        ? folderEmpty
        : empty
      : null;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>{title}</div>
          {subtitle && <div className={styles.pageSubtitle}>{subtitle}</div>}
        </div>
      </div>

      <div className={styles.toolbar}>
        {toolbarStart?.({ filtered })}

        {toolbarStart && <div className={styles.dividerV} />}

        <FilterBar
          config={filterConfig}
          state={filter}
          setState={setFilter}
          fields={filterFields}
          setFields={setFilterFields}
          canEditFields={canEditFields}
          settings={filterSettings}
        />

        <div style={{ flex: 1 }} />

        {selectable && selected.size > 0 && (
          <>
            <span className={styles.selectionCount}>{selected.size} выбрано</span>
            {selectionActions?.({
              selected: selectedRows,
              clear: clearSelection,
            })}
            <div className={styles.dividerV} />
          </>
        )}

        {(hasCards || hasBoard) && (
          <div className={styles.viewSwitch}>
            <button
              data-active={String(viewMode === "list")}
              title="Таблица"
              onClick={() => setViewMode("list")}
            >
              <Icon name="list" size={14} />
            </button>
            {hasCards && (
              <button
                data-active={String(viewMode === "cards")}
                title="Карточки"
                onClick={() => setViewMode("cards")}
              >
                <Icon name="cards" size={14} />
              </button>
            )}
            {hasBoard && (
              <button
                data-active={String(viewMode === "board")}
                title="Доска"
                onClick={() => setViewMode("board")}
              >
                <Icon name="board" size={14} />
              </button>
            )}
          </div>
        )}

        {toolbarEnd?.({ viewMode })}
      </div>

      {viewMode !== "board" && (dropBar || crumbs)}

      {viewMode === "list" && (
        <>
          <div className={styles.tableWrap} ref={wrapRef} data-testid="list-table-wrap">
            <table className={styles.tbl} style={{ minWidth: tableMinWidth }}>
              <colgroup>
                <col style={{ width: ACTIONS_COL_WIDTH }} />
                {visibleColumns.map((c, i) => (
                  <col key={c.key} style={{ width: colWidths[i] }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className={styles.colGear}>
                    <button
                      ref={gearRef}
                      type="button"
                      className={styles.gearBtn}
                      title="Настроить колонки"
                      aria-label="Настроить колонки"
                      aria-expanded={colsOpen}
                      onClick={openCols}
                    >
                      <Icon name="settings" size={14} />
                    </button>
                  </th>
                  {visibleColumns.map((c, i) => {
                    // Первая колонка резервирует место под чекбокс-по-наведению.
                    const hostCls = selectable && i === 0 ? styles.colSelectHost : undefined;
                    return c.sortValue ? (
                      <th
                        key={c.key}
                        className={hostCls}
                        data-sortable=""
                        data-sort={sort.key === c.key ? sort.dir : undefined}
                        onClick={() => toggleSort(c.key)}
                      >
                        {c.label}
                        <span className={styles.sortArrow}>
                          <Icon name={sort.dir === "asc" ? "sortup" : "sortdown"} size={11} />
                        </span>
                      </th>
                    ) : (
                      <th key={c.key} className={hostCls}>
                        {c.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              {level ? (
                <tbody>
                  {levelEmpty ? (
                    <tr>
                      <td colSpan={colSpan}>{levelEmpty}</td>
                    </tr>
                  ) : (
                    <>
                      {level.folders.map(({ group: g, rows }) => folderRow(g, rows))}
                      {level.rows.map(renderRow)}
                    </>
                  )}
                </tbody>
              ) : (
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={colSpan}>{empty}</td>
                    </tr>
                  ) : (
                    visible.map(renderRow)
                  )}
                </tbody>
              )}
            </table>
          </div>
          <div
            className={styles.hScroll}
            ref={hScrollRef}
            data-testid="list-hscroll"
            data-visible={hOverflow ? "true" : undefined}
            aria-hidden="true"
          >
            <div style={{ width: tableMinWidth }} />
          </div>
          {/* Сентинел: как только виден — догружаем следующую порцию строк. */}
          {!level && hasMore && <div ref={sentinelRef} className={styles.cardsSentinel} />}
        </>
      )}

      {colsOpen && (
        <>
          <div className={styles.colsBackdrop} onClick={closeCols} />
          <div className={styles.colsModal} role="dialog" aria-modal="true" aria-label={colsTitle}>
            <div className={styles.colsModalHead}>
              <div className={styles.colsModalTitle}>{colsTitle}</div>
              <button
                type="button"
                className={styles.colsModalClose}
                onClick={closeCols}
                aria-label="Закрыть"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className={styles.colsSearchRow}>
              <input
                className={styles.colsSearch}
                value={colsQuery}
                onChange={(e) => setColsQuery(e.target.value)}
                placeholder="Поиск по полям"
                autoFocus
              />
            </div>

            <div className={styles.colsModalBody}>
              {shownCols.length === 0 ? (
                <div className={styles.colsNothing}>Поля не найдены</div>
              ) : (
                <div className={styles.colsGrid}>
                  {shownCols.map((c) => {
                    const on = !draftHidden.has(c.key);
                    // Последнюю видимую колонку выключить нельзя — иначе таблица пустая.
                    const lockLast = on && draftVisibleCount === 1;
                    return (
                      <label
                        key={c.key}
                        className={styles.colsGridItem}
                        data-on={on || undefined}
                        title={c.label}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={lockLast}
                          onChange={() => toggleDraft(c.key)}
                        />
                        <span>{c.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={styles.colsModalFoot}>
              <label className={styles.colsSelectAll}>
                <input
                  type="checkbox"
                  ref={selectAllRef}
                  checked={draftVisibleCount === toggleableCols.length}
                  onChange={toggleAllDraft}
                />
                <span>выбрать все</span>
              </label>
              {canEditFields && filterSettings && (
                <label
                  className={styles.colsSelectAll}
                  title="Набор колонок станет общим — его увидят все, кто не настраивал колонки под себя"
                >
                  <input
                    type="checkbox"
                    checked={colsForAll}
                    onChange={(e) => setColsForAll(e.target.checked)}
                  />
                  <span>для всех</span>
                </label>
              )}
              <div className={styles.colsFootActions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={applyCols}
                >
                  Применить
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGhost}`}
                  onClick={closeCols}
                >
                  Отменить
                </button>
              </div>
              <button type="button" className={styles.colsReset} onClick={resetCols}>
                по умолчанию
              </button>
            </div>
          </div>
        </>
      )}

      {viewMode === "cards" &&
        renderCard &&
        level &&
        (levelEmpty ?? (
          <>
            {level.folders.length > 0 && (
              <div className={styles.folderGrid}>
                {level.folders.map(({ group: g, rows }) => folderTile(g, rows))}
              </div>
            )}
            {level.rows.length > 0 && (
              <div className={styles.listCardsGrid}>
                {level.rows.map((row) => (
                  <div key={getId(row)} {...dragProps(row)}>
                    {renderCard(row)}
                  </div>
                ))}
              </div>
            )}
          </>
        ))}

      {viewMode === "cards" &&
        renderCard &&
        !level &&
        (visible.length === 0 ? (
          empty
        ) : (
          <>
            <div className={styles.listCardsGrid}>
              {visible.map((row) => (
                <Fragment key={getId(row)}>{renderCard(row)}</Fragment>
              ))}
            </div>
            {/* Сентинел: как только виден — догружаем следующую порцию. */}
            {hasMore && <div ref={sentinelRef} className={styles.cardsSentinel} />}
          </>
        ))}

      {viewMode === "board" &&
        renderBoard &&
        (filtered.length === 0 ? empty : <>{renderBoard(filtered)}</>)}

      {/* Под таблицей строки нет: она догружается по прокрутке, как карточки
          (владелец, 30.10.2026), и под папками тоже
          — ни «Показано», ни «Папок: N». Доска показывает всё сразу, счётчик под ней
          не нужен (владелец, 27.10.2026). Под карточками — «Показано N из M». */}
      {viewMode === "cards" && !level ? (
        <div className={styles.pager}>
          <div>
            Показано {visible.length} из {filtered.length}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ListPage;
