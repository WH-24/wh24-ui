import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FormsApiError, type FormsApi } from "../api";
import type { Field, Form, FormRecord, SchemaDocument } from "../types";
import { FormRecordEditor } from "./FormRecordEditor";
import { FormRecordView } from "./FormRecordView";
import { FormRecordsPage, recordsQuery } from "./FormRecordsPage";
import { Pager, pageItems } from "./Pager";

const f = (over: Partial<Field> & Pick<Field, "id" | "type">): Field => ({
  key: over.id,
  label: over.id,
  section_id: "s1",
  span: 6,
  required: false,
  show_in_list: false,
  filterable: false,
  archived: false,
  ...over,
});

const schema: SchemaDocument = {
  schema_version: 1,
  title_field: "name",
  sections: [{ id: "s1", title: "Основное", sort: 0 }],
  fields: [
    f({ id: "name", type: "text", label: "Название", required: true }),
    f({
      id: "budget",
      type: "money",
      label: "Бюджет",
      show_in_list: true,
      config: { currency: "RUB" },
    }),
    f({
      id: "owner",
      type: "user",
      label: "Ответственный",
      show_in_list: true,
    }),
    f({ id: "note", type: "textarea", label: "Заметка" }),
  ],
};

const form: Form = {
  id: "form-1",
  module_key: "oup",
  key: "finmodel",
  name: "Финансовая модель",
  nav_label: "Финансовые модели",
  page_title: "Финансовые модели",
  description: "Бюджеты контрактов",
  icon: "chart",
  status: "published",
  current_version: 3,
  draft_schema: null,
  draft_updated_at: null,
  draft_updated_by: null,
  record_access: "module",
  sort_order: 0,
  created_by: "u0",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  archived_at: null,
};

const rec = (n: number, over: Partial<FormRecord> = {}): FormRecord => ({
  id: `r${n}`,
  form_id: form.id,
  form_version: 3,
  number: n,
  title: `Запись ${n}`,
  data: { name: `Запись ${n}`, budget: n * 1000000, owner: "u1" },
  status: "open",
  created_by: "u1",
  updated_by: null,
  created_at: "2026-03-01T10:00:00Z",
  updated_at: "2026-03-01T10:00:00Z",
  deleted_at: null,
  ...over,
});

function mockApi(
  over: Partial<{
    list: unknown;
    create: unknown;
    update: unknown;
    history: unknown;
  }> = {},
) {
  const list = vi.fn(async () => ({ data: [rec(1), rec(2)], total: 2 }));
  const create = vi.fn(
    async (_f: string, body: { title: string; data: unknown }) =>
      rec(9, { title: body.title }),
  );
  const update = vi.fn(
    async (_f: string, _id: string, body: { title: string }) =>
      rec(1, { title: body.title }),
  );
  const history = vi.fn(async () => []);
  const api = {
    records: {
      list: (over.list as typeof list) ?? list,
      create: (over.create as typeof create) ?? create,
      update: (over.update as typeof update) ?? update,
      history: (over.history as typeof history) ?? history,
      uploadFile: vi.fn(),
      fileUrl: vi.fn(),
      exportCsvUrl: (id: string) => `/api/v1/forms/${id}/export.csv`,
    },
  } as unknown as FormsApi;
  return { api, list, create, update, history };
}

const ctx = { staff: [{ id: "u1", label: "Иван Петров" }] };

beforeEach(() => {
  localStorage.clear();
});

describe("Pager", () => {
  it("pageItems: окно с многоточиями", () => {
    expect(pageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageItems(1, 26)).toEqual([1, 2, 3, 4, "…", 26]);
    expect(pageItems(13, 26)).toEqual([1, "…", 12, 13, 14, "…", 26]);
    expect(pageItems(26, 26)).toEqual([1, "…", 23, 24, 25, 26]);
  });

  it("диапазон, границы и переход по Enter", async () => {
    const user = userEvent.setup();
    const onPage = vi.fn();
    render(<Pager page={2} pageSize={50} total={1284} onPage={onPage} />);
    expect(screen.getByText(/51–100 из 1\s284/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Предыдущая страница" }),
    ).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Страница 26" }));
    expect(onPage).toHaveBeenCalledWith(26);
    const goto = screen.getByLabelText("Перейти к странице");
    await user.clear(goto);
    await user.type(goto, "999{Enter}");
    expect(onPage).toHaveBeenLastCalledWith(26); // clamp к последней
  });

  it("на последней странице «Следующая» выключена; total=0 → «0 из 0»", () => {
    render(<Pager page={1} pageSize={50} total={0} onPage={() => {}} />);
    expect(
      screen.getByRole("button", { name: "Следующая страница" }),
    ).toBeDisabled();
    expect(screen.getByText("0 из 0")).toBeInTheDocument();
  });
});

// Единый вид списков (17.11.2026): страница записей — общий ListPage в серверном
// режиме. Догрузка — по прокрутке (IntersectionObserver), без кнопок страниц.
let ioCallback: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
beforeEach(() => {
  ioCallback = null;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        ioCallback = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

/** Подписи колонок без служебной (шестерёнка). */
const heads = () =>
  screen
    .getAllByRole("columnheader")
    .map((h) => h.textContent ?? "")
    .filter(Boolean);

describe("recordsQuery — условия плашек → запрос к серверу", () => {
  it("поиск, «На контроле», статусы и поля-списки", () => {
    expect(recordsQuery({})).toEqual({
      search: undefined,
      watching: undefined,
      status: undefined,
      filters: undefined,
    });
    expect(
      recordsQuery({
        q: "  счёт ",
        watching: true,
        status: ["open"],
        "f:kind": ["it", "hr"],
        "f:owner": "u1",
        "f:empty": [],
        other: "x",
      }),
    ).toEqual({
      search: "счёт",
      watching: true,
      status: ["open"],
      filters: { kind: ["it", "hr"], owner: ["u1"] },
    });
  });
});

describe("FormRecordsPage", () => {
  it("общий список: шапка с описанием и числом записей, колонки по show_in_list, клик по строке", async () => {
    const user = userEvent.setup();
    const { api, list } = mockApi();
    const onOpen = vi.fn();
    render(
      <FormRecordsPage
        form={form}
        schema={schema}
        api={api}
        ctx={ctx}
        onOpen={onOpen}
      />,
    );
    expect(await screen.findByText("Запись 1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Финансовые модели");
    expect(screen.getByText("Бюджеты контрактов · 2 записи")).toBeInTheDocument();
    expect(heads()).toEqual(["№", "Название", "Бюджет", "Ответственный", "Статус", "Обновлено"]);
    expect(screen.getByRole("button", { name: "Настроить колонки" })).toBeInTheDocument();
    expect(screen.getByText(/1\s000\s000\s₽/)).toBeInTheDocument();
    expect(screen.getAllByText("Иван Петров")).toHaveLength(2);
    expect(list).toHaveBeenCalledWith(
      "form-1",
      expect.objectContaining({ page: 1, limit: 50, sort: "number_desc" }),
    );
    await user.click(screen.getByText("Запись 2"));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "r2" }));
  });

  it("кнопки строкой слева: «Создать», «Экспорт», кнопки хоста", async () => {
    const { api } = mockApi();
    render(
      <FormRecordsPage
        form={form}
        schema={schema}
        api={api}
        canCreate
        onCreate={vi.fn()}
        actions={<button type="button">Синхронизировать с Pyrus</button>}
      />,
    );
    await screen.findByText("Запись 1");
    expect(screen.getByRole("button", { name: "Создать" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Экспорт" })).toHaveAttribute(
      "href",
      "/api/v1/forms/form-1/export.csv",
    );
    expect(screen.getByRole("button", { name: "Синхронизировать с Pyrus" })).toBeInTheDocument();
  });

  it("виды: вкладка «На контроле» уходит на сервер, счётчик у выбранной", async () => {
    const user = userEvent.setup();
    const { api, list } = mockApi();
    const onViewChange = vi.fn();
    render(
      <FormRecordsPage
        form={form}
        schema={schema}
        api={api}
        views={[
          { id: "all", label: "Все записи", state: {} },
          { id: "watch", label: "На контроле", state: { watching: true } },
        ]}
        onViewChange={onViewChange}
      />,
    );
    await screen.findByText("Запись 1");
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Все записи2", "На контроле"]);
    await user.click(tabs[1]!);
    expect(onViewChange).toHaveBeenCalledWith("watch");
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        "form-1",
        expect.objectContaining({ watching: true, page: 1 }),
      ),
    );
  });

  it("поиск — в поле с плашками, уходит на сервер с задержкой", async () => {
    const user = userEvent.setup();
    const { api, list } = mockApi();
    render(<FormRecordsPage form={form} schema={schema} api={api} />);
    await screen.findByText("Запись 1");
    await user.type(screen.getByPlaceholderText("Поиск по названию"), "Ло");
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        "form-1",
        expect.objectContaining({ search: "Ло", page: 1 }),
      ),
    );
    expect(list.mock.calls.some((c) => (c[1] as { search?: string }).search === "Л")).toBe(false);
  });

  it("по умолчанию фильтр — как у «Оборудования»: условия в строке поиска, панель по щелчку", async () => {
    const { api } = mockApi();
    render(<FormRecordsPage form={form} schema={schema} api={api} ctx={ctx} />);
    await screen.findByText("Запись 1");
    expect(screen.getByPlaceholderText("Поиск по названию")).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("button", { name: "Фильтр" })).toBeNull();
  });

  it("плашки (filterVariant=chips): статус и поле-список уходят на сервер", async () => {
    const user = userEvent.setup();
    const { api, list } = mockApi();
    render(<FormRecordsPage form={form} schema={schema} api={api} ctx={ctx} filterVariant="chips" />);
    await screen.findByText("Запись 1");
    await user.click(screen.getByRole("button", { name: "Фильтр" }));
    await user.click(screen.getByRole("menuitem", { name: "Статус" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Открыта" }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        "form-1",
        expect.objectContaining({ status: ["open"], page: 1 }),
      ),
    );
  });

  it("низ списка виден — следующая порция с сервера дописывается", async () => {
    const list = vi.fn(async (_id: string, q: { page?: number }) =>
      q.page === 2 ? { data: [rec(3)], total: 3 } : { data: [rec(1), rec(2)], total: 3 },
    );
    const { api } = mockApi({ list });
    render(<FormRecordsPage form={form} schema={schema} api={api} pageSize={2} />);
    await screen.findByText("Запись 1");
    expect(screen.queryByRole("button", { name: "Следующая страница" })).toBeNull();
    await waitFor(() => {
      act(() => ioCallback?.([{ isIntersecting: true }]));
      expect(list).toHaveBeenCalledWith("form-1", expect.objectContaining({ page: 2 }));
    });
    expect(await screen.findByText("Запись 3")).toBeInTheDocument();
    expect(screen.getByText("Запись 1")).toBeInTheDocument();
    expect(list).toHaveBeenLastCalledWith("form-1", expect.objectContaining({ page: 2, limit: 2 }));
  });

  it("выбор строк и массовое действие: флажки, панель", async () => {
    const user = userEvent.setup();
    const { api } = mockApi();
    const onRun = vi.fn(async () => undefined);
    const onOpen = vi.fn();
    render(
      <FormRecordsPage
        form={form}
        schema={schema}
        api={api}
        onOpen={onOpen}
        selectable
        bulkActions={[{ label: "Удалить", tone: "danger", onRun }]}
      />,
    );
    await screen.findByText("Запись 1");
    await user.click(screen.getAllByLabelText("Выбрать строку")[0]!);
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByRole("toolbar", { name: "Действия с выбранными" })).toHaveTextContent(
      "Выбрано: 1",
    );
    await user.click(screen.getByRole("button", { name: "Удалить" }));
    expect(onRun).toHaveBeenCalledWith(["r1"], undefined);
  });

  it("403 → «нет доступа»; 503 → авария с «Повторить», не отказ", async () => {
    const user = userEvent.setup();
    const forbidden = mockApi({
      list: vi.fn(async () => {
        throw new FormsApiError(403, "forbidden");
      }),
    });
    const { unmount } = render(<FormRecordsPage form={form} schema={schema} api={forbidden.api} />);
    expect(await screen.findByText(/Нет доступа к записям/)).toBeInTheDocument();
    unmount();

    let calls = 0;
    const flaky = mockApi({
      list: vi.fn(async () => {
        calls += 1;
        if (calls === 1) throw new FormsApiError(503, "модуль недоступен");
        return { data: [rec(1)], total: 1 };
      }),
    });
    render(<FormRecordsPage form={form} schema={schema} api={flaky.api} />);
    expect(await screen.findByText(/Сервис временно недоступен/)).toBeInTheDocument();
    expect(screen.queryByText(/Нет доступа к записям/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByText("Запись 1")).toBeInTheDocument();
  });

  it("пусто → «Пока нет записей» + Создать (только с правом и у опубликованной формы)", async () => {
    const { api } = mockApi({
      list: vi.fn(async () => ({ data: [], total: 0 })),
    });
    const onCreate = vi.fn();
    const { rerender } = render(
      <FormRecordsPage form={form} schema={schema} api={api} canCreate onCreate={onCreate} />,
    );
    expect(await screen.findByText("Пока нет записей")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Создать/ }).length).toBeGreaterThan(0);

    rerender(
      <FormRecordsPage
        form={{ ...form, status: "archived" }}
        schema={schema}
        api={api}
        canCreate
        onCreate={onCreate}
      />,
    );
    expect(await screen.findByText(/Форма в архиве/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Создать/ })).not.toBeInTheDocument();
  });

  it("поиск без результата → «Ничего не найдено» и «Показать все строки»", async () => {
    const user = userEvent.setup();
    const { api } = mockApi({
      list: vi.fn(async (_f: string, q: { search?: string }) =>
        q.search ? { data: [], total: 0 } : { data: [rec(1)], total: 1 },
      ),
    });
    render(<FormRecordsPage form={form} schema={schema} api={api} />);
    await screen.findByText("Запись 1");
    await user.type(screen.getByPlaceholderText("Поиск по названию"), "zzz");
    expect(await screen.findByText("Ничего не найдено")).toBeInTheDocument();
  });

  it("шестерёнка в шапке таблицы скрывает колонку и запоминает выбор", async () => {
    const user = userEvent.setup();
    const { api } = mockApi();
    const { unmount } = render(<FormRecordsPage form={form} schema={schema} api={api} />);
    await screen.findByText("Запись 1");
    await user.click(screen.getByRole("button", { name: "Настроить колонки" }));
    const dlg = screen.getByRole("dialog");
    await user.click(within(dlg).getByRole("checkbox", { name: "Бюджет" }));
    await user.click(within(dlg).getByRole("button", { name: "Применить" }));
    expect(heads()).not.toContain("Бюджет");
    unmount();
    render(<FormRecordsPage form={form} schema={schema} api={api} />);
    await screen.findByText("Запись 1");
    expect(heads()).not.toContain("Бюджет");
  });
});

describe("FormRecordView", () => {
  it("шапка, статус, тело; история грузится по кнопке и показывает было → стало", async () => {
    const user = userEvent.setup();
    const loadHistory = vi.fn(async () => [
      {
        id: "h1",
        record_id: "r1",
        form_version: 3,
        actor: "u1",
        at: "2026-03-02T09:00:00Z",
        action: "updated" as const,
        changes: { budget: { from: 1000000, to: 1500000 } },
      },
    ]);
    render(
      <FormRecordView
        form={form}
        schema={schema}
        record={rec(1)}
        ctx={ctx}
        loadHistory={loadHistory}
        actorName={(id) => (id === "u1" ? "Иван Петров" : id)}
        currentVersion={4}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Запись 1",
    );
    expect(screen.getByText("Открыта")).toBeInTheDocument();
    expect(screen.getByText(/v3, текущая — v4/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /История/ }));
    expect(await screen.findByText("Изменена")).toBeInTheDocument();
    expect(loadHistory).toHaveBeenCalledTimes(1);
    const diff = screen.getByText("Бюджет", {
      selector: "span",
    }).parentElement!;
    expect(within(diff).getByText(/1\s000\s000/)).toBeInTheDocument();
    expect(within(diff).getByText(/1\s500\s000/)).toBeInTheDocument();
  });
});

describe("FormRecordView — с лентой: общая карточка записи RecordCard (14.11.2026)", () => {
  it("есть лента — карточка записи: «Обсуждение» слева, «Поля» справа; нет — одна колонка полей", () => {
    const { rerender } = render(
      <FormRecordView
        form={form}
        schema={schema}
        record={rec(1)}
        ctx={ctx}
        discussion={<div>Лента записи</div>}
      />,
    );
    const talk = screen.getByRole("region", { name: "Обсуждение" });
    const fields = screen.getByRole("region", { name: "Поля" });
    expect(talk).toHaveTextContent("Лента записи");
    // Шапка записи — над панелями, а не внутри полей; номер — чипом.
    expect(within(fields).queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Запись 1");
    expect(screen.getByText("№1")).toBeInTheDocument();
    rerender(
      <FormRecordView form={form} schema={schema} record={rec(1)} ctx={ctx} />,
    );
    expect(screen.queryByRole("region", { name: "Обсуждение" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Поля" })).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Запись 1",
    );
  });

  it("действия карточки: «Редактировать» у вкладки «Поля», «Удалить» в меню «⋯», Pyrus — ссылкой; «Истории» вкладкой нет — правки в ленте", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const loadHistory = vi.fn().mockResolvedValue([]);
    render(
      <FormRecordView
        form={form}
        schema={schema}
        record={rec(1)}
        ctx={ctx}
        discussion={<div>Лента записи</div>}
        onEdit={onEdit}
        onDelete={onDelete}
        loadHistory={loadHistory}
        pyrusUrl="https://pyrus.com/t#id1"
        route={{ steps: [], current_step_id: null, finished: false }}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Редактировать/ }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: /Открыть в Pyrus/ })).toHaveAttribute(
      "href",
      "https://pyrus.com/t#id1",
    );
    await user.click(screen.getByRole("button", { name: "Ещё действия" }));
    await user.click(screen.getByRole("menuitem", { name: "Удалить" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    // Истории отдельной вкладкой нет: правки записи показывает лента.
    expect(screen.queryByRole("tab", { name: "История" })).toBeNull();
    expect(screen.queryByRole("button", { name: /История/ })).toBeNull();
    expect(loadHistory).not.toHaveBeenCalled();
  });
});

describe("FormRecordView — полоса стадий согласования (route_stages, 14.11.2026)", () => {
  const route = {
    steps: [
      { id: "s1", name: "Руководитель", state: "passed" as const, approvers: [] },
      { id: "s2", name: "Бухгалтерия", state: "current" as const, approvers: [] },
    ],
    current_step_id: "s2",
    finished: false,
  };
  const view = (over: Partial<Parameters<typeof FormRecordView>[0]> = {}) => (
    <FormRecordView
      form={{ ...form, route_stages: true }}
      schema={schema}
      record={rec(1)}
      ctx={ctx}
      discussion={<div>Лента</div>}
      route={route}
      {...over}
    />
  );

  it("включена — «Инициализация» и этапы маршрута, текущий этап отмечен; стадии не нажимаются", () => {
    render(view());
    const strip = screen.getByRole("navigation", { name: "Стадия" });
    const names = within(strip)
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(names).toEqual(["Инициализация", "Руководитель", "Бухгалтерия"]);
    expect(within(strip).getByRole("button", { name: "Бухгалтерия" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(within(strip).getByRole("button", { name: "Руководитель" })).toBeDisabled();
  });

  it("согласование не начато — «Инициализация»; пройдено — последний этап", () => {
    const { rerender } = render(view({ route: { ...route, current_step_id: null } }));
    expect(screen.getByRole("button", { name: "Инициализация" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    rerender(view({ route: { ...route, current_step_id: null, finished: true } }));
    expect(screen.getByRole("button", { name: "Бухгалтерия" })).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("настройка выключена или маршрут ещё не загружен — полосы нет", () => {
    const { rerender } = render(view({ form }));
    expect(screen.queryByRole("navigation", { name: "Стадия" })).toBeNull();
    rerender(view({ route: null }));
    expect(screen.queryByRole("navigation", { name: "Стадия" })).toBeNull();
  });

  it("включена, у формы нет маршрута — статусы записи, как у лида (17.11.2026)", () => {
    const empty = { steps: [], current_step_id: null, finished: false };
    const { rerender } = render(view({ route: empty, record: rec(1, { status: "closed" }) }));
    const strip = screen.getByRole("navigation", { name: "Стадия" });
    expect(within(strip).getAllByRole("button").map((b) => b.textContent)).toEqual(["Открыта", "Закрыта"]);
    expect(within(strip).getByRole("button", { name: "Закрыта" })).toHaveAttribute("aria-current", "step");
    // Строки «Статус · Создал · Изменено · Версия формы» в шапке нет (владелец 17.11.2026).
    expect(screen.queryByText(/Версия формы|Создал/)).toBeNull();
    rerender(view({ route: empty, record: rec(1, { status: "review" }) }));
    expect(
      within(screen.getByRole("navigation", { name: "Стадия" }))
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Открыта", "На согласовании", "Закрыта"]);
  });
});

describe("FormRecordView — правка только на «Инициализации» (14.11.2026)", () => {
  const INIT = "00000000-0000-0000-0000-000000000000";
  const routeAt = (init: "current" | "passed") => ({
    steps: [
      { id: INIT, name: "Инициализация", state: init, approvers: [] },
      {
        id: "s1",
        name: "Руководитель",
        state: init === "current" ? ("pending" as const) : ("current" as const),
        approvers: [],
      },
    ],
    current_step_id: init === "current" ? INIT : "s1",
    finished: false,
  });
  const view = (route: Parameters<typeof FormRecordView>[0]["route"]) => (
    <FormRecordView
      form={{ ...form, route_stages: true }}
      schema={schema}
      record={rec(1)}
      ctx={ctx}
      discussion={<div>Лента</div>}
      onEdit={() => {}}
      route={route}
    />
  );

  it("на «Инициализации» «Редактировать» есть; на согласовании и пока маршрут не загружен — нет", () => {
    const { rerender } = render(view(routeAt("current")));
    expect(screen.getByRole("button", { name: /Редактировать/ })).toBeInTheDocument();
    rerender(view(routeAt("passed")));
    expect(screen.queryByRole("button", { name: /Редактировать/ })).toBeNull();
    rerender(view(null));
    expect(screen.queryByRole("button", { name: /Редактировать/ })).toBeNull();
  });

  it("полоса стадий: «Инициализация» из маршрута не дублируется", () => {
    render(view(routeAt("current")));
    const strip = screen.getByRole("navigation", { name: "Стадия" });
    expect(within(strip).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Инициализация",
      "Руководитель",
    ]);
    expect(within(strip).getByRole("button", { name: "Инициализация" })).toHaveAttribute(
      "aria-current",
      "step",
    );
  });
});

describe("FormRecordEditor — в карточке записи (layout=card, 17.11.2026)", () => {
  it("новая запись — та же карточка: путь, заголовок из поля, без строки «Статус · Создал», лента с пояснением, «Создать запись» у полей", async () => {
    const user = userEvent.setup();
    const { api, create } = mockApi();
    const onSaved = vi.fn();
    render(
      <FormRecordEditor
        form={{ ...form, route_stages: true }}
        schema={schema}
        api={api}
        ctx={ctx}
        layout="card"
        onSaved={onSaved}
        onCancel={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Новая запись");
    expect(screen.queryByText(/Не сохранена|Версия формы/)).toBeNull();
    expect(screen.getByText("Лента начнётся после создания")).toBeInTheDocument();
    const strip = screen.getByRole("navigation", { name: "Стадия" });
    expect(within(strip).getByRole("button", { name: "Открыта" })).toHaveAttribute("aria-current", "step");
    await user.type(screen.getByRole("textbox", { name: /Название/ }), "Счёт 1");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Счёт 1");
    await user.click(screen.getByRole("button", { name: "Создать запись" }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalled();
  });

  it("правка — лента хоста слева, этапы маршрута в полосе", () => {
    const { api } = mockApi();
    render(
      <FormRecordEditor
        form={{ ...form, route_stages: true }}
        schema={schema}
        api={api}
        record={rec(1)}
        layout="card"
        discussion={<div>Лента записи</div>}
        route={{
          steps: [{ id: "s1", name: "Руководитель", state: "pending", approvers: [] }],
          current_step_id: null,
          finished: false,
        }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Лента записи")).toBeInTheDocument();
    expect(screen.getByText("№1")).toBeInTheDocument();
    const strip = screen.getByRole("navigation", { name: "Стадия" });
    expect(within(strip).getAllByRole("button").map((b) => b.textContent)).toEqual(["Инициализация", "Руководитель"]);
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeInTheDocument();
  });
});

describe("FormRecordEditor", () => {
  it("локальная валидация блокирует отправку; правка поля снимает ошибку", async () => {
    const user = userEvent.setup();
    const { api, create } = mockApi();
    render(
      <FormRecordEditor
        form={form}
        schema={schema}
        api={api}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Создать запись" }));
    expect(create).not.toHaveBeenCalled();
    expect(
      screen.getByText("поле «Название» обязательно для заполнения"),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Название*"), "Лофт");
    expect(
      screen.queryByText("поле «Название» обязательно для заполнения"),
    ).not.toBeInTheDocument();
  });

  it("создание: название берётся из title_field, onSaved получает запись, dirty сообщается", async () => {
    const user = userEvent.setup();
    const { api, create } = mockApi();
    const onSaved = vi.fn();
    const onDirtyChange = vi.fn();
    render(
      <FormRecordEditor
        form={form}
        schema={schema}
        api={api}
        onSaved={onSaved}
        onCancel={vi.fn()}
        onDirtyChange={onDirtyChange}
      />,
    );
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await user.type(screen.getByLabelText("Название*"), "Лофт на Кутузовском");
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Лофт на Кутузовском",
    );
    await user.click(screen.getByRole("button", { name: "Создать запись" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith("form-1", {
      title: "Лофт на Кутузовском",
      data: { name: "Лофт на Кутузовском" },
    });
  });

  it("серверные 400 fields ложатся инлайн; 409 — баннер «не опубликована»", async () => {
    const user = userEvent.setup();
    const { api } = mockApi({
      create: vi.fn(async () => {
        throw new FormsApiError(400, "значения не прошли проверку", [
          {
            field_id: "budget",
            code: "min",
            message: "поле «Бюджет»: не меньше 0",
          },
        ]);
      }),
    });
    const { unmount } = render(
      <FormRecordEditor
        form={form}
        schema={schema}
        api={api}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Название*"), "x");
    await user.click(screen.getByRole("button", { name: "Создать запись" }));
    expect(
      await screen.findByText("поле «Бюджет»: не меньше 0"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Бюджет")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    unmount();

    const conflict = mockApi({
      create: vi.fn(async () => {
        throw new FormsApiError(409, "форма не опубликована");
      }),
    });
    render(
      <FormRecordEditor
        form={form}
        schema={schema}
        api={conflict.api}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Название*"), "x");
    await user.click(screen.getByRole("button", { name: "Создать запись" }));
    expect(
      await screen.findByText(/Форма не опубликована/),
    ).toBeInTheDocument();
  });

  it("редактирование старой записи: баннер «Форма обновлена» и бейдж НОВОЕ; update с прежним id", async () => {
    const user = userEvent.setup();
    const { api, update } = mockApi();
    const oldSchema: SchemaDocument = {
      ...schema,
      fields: schema.fields.filter((x) => x.id !== "note"),
    };
    const onSaved = vi.fn();
    render(
      <FormRecordEditor
        form={form}
        schema={schema}
        recordSchema={oldSchema}
        record={rec(1, { form_version: 2 })}
        api={api}
        ctx={ctx}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/Форма обновлена \(v2 → v3\)/)).toBeInTheDocument();
    expect(screen.getByText("НОВОЕ")).toBeInTheDocument();
    // У существующей записи файлов нет в схеме — но заголовок из title_field на месте.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Запись 1",
    );
    await user.click(screen.getAllByRole("button", { name: "Сохранить" })[0]!);
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith(
      "form-1",
      "r1",
      expect.objectContaining({ title: "Запись 1" }),
    );
  });

  it("без title_field название вводится вручную и обязательно", async () => {
    const user = userEvent.setup();
    const { api, create } = mockApi();
    render(
      <FormRecordEditor
        form={form}
        schema={{ ...schema, title_field: "" }}
        api={api}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Название*"), "x");
    await user.click(screen.getByRole("button", { name: "Создать запись" }));
    expect(screen.getByText("укажите название записи")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Название записи"), "Ручное");
    await user.click(screen.getByRole("button", { name: "Создать запись" }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        "form-1",
        expect.objectContaining({ title: "Ручное" }),
      ),
    );
  });
});

describe("FormRecordsPage — ячейки новых типов (06.11.2026)", () => {
  it("теги — чипы и «+N», процент — progressbar, цвет — подпись", async () => {
    const sch: SchemaDocument = {
      ...schema,
      fields: [
        f({ id: "name", type: "text", label: "Название", required: true }),
        f({ id: "tg", type: "tags", label: "Метки", show_in_list: true }),
        f({
          id: "pct",
          type: "percent",
          label: "Готовность",
          show_in_list: true,
        }),
        f({ id: "col", type: "color", label: "Цвет", show_in_list: true }),
      ],
    };
    const list = vi.fn(async () => ({
      data: [
        rec(1, {
          data: { name: "Запись 1", tg: ["a", "b", "c"], pct: 45, col: "teal" },
        }),
      ],
      total: 1,
    }));
    const { api } = mockApi({ list });
    render(<FormRecordsPage form={form} schema={sch} api={api} ctx={ctx} />);
    expect(await screen.findByText("Запись 1")).toBeInTheDocument();
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
    expect(screen.queryByText("c")).not.toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "45",
    );
    expect(screen.getByText("Бирюзовый")).toBeInTheDocument();
  });
});

describe("FormRecordsPage — колонки хоста и onRowsChange (06.11.2026)", () => {
  const aiCol = (
    over: Partial<import("@wowhaus-24/ui-react").ListColumn<FormRecord>> = {},
  ): import("@wowhaus-24/ui-react").ListColumn<FormRecord> => ({
    key: "ai_f1",
    label: "Теплота",
    minWidth: 220,
    render: (r) => (
      <span>
        <span>{`ИИ ${r.id}`}</span>
        <button type="button">{`Повторить ${r.id}`}</button>
      </span>
    ),
    headerActions: <button type="button">Меню поля</button>,
    ...over,
  });

  it("extraColumns: после схемных, перед «Статус»; чужой ключ пропускается; клик по кнопке в ячейке не открывает запись", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const { api } = mockApi();
    render(
      <FormRecordsPage
        form={form}
        schema={schema}
        api={api}
        ctx={ctx}
        onOpen={onOpen}
        extraColumns={[aiCol(), aiCol({ key: "status", label: "Подмена" })]}
      />,
    );
    await screen.findByText("Запись 1");
    expect(heads()).toEqual(["№", "Название", "Бюджет", "Ответственный", "ТеплотаМеню поля", "Статус", "Обновлено"]);
    expect(screen.queryByText(/Подмена/)).toBeNull();
    expect(screen.getByText("ИИ r1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Повторить r1" }));
    expect(onOpen).not.toHaveBeenCalled();
    await user.click(screen.getByText("ИИ r2"));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "r2" }));
  });

  it("onRowsChange: после загрузки — один раз; тот же набор id при перерисовке — без вызова", async () => {
    const onRowsChange = vi.fn();
    const { api } = mockApi();
    const { rerender } = render(
      <FormRecordsPage form={form} schema={schema} api={api} onRowsChange={onRowsChange} />,
    );
    await screen.findByText("Запись 1");
    expect(onRowsChange).toHaveBeenCalledTimes(1);
    expect(onRowsChange.mock.calls[0]![0].map((r: FormRecord) => r.id)).toEqual(["r1", "r2"]);
    rerender(
      <FormRecordsPage
        form={form}
        schema={schema}
        api={api}
        onRowsChange={onRowsChange}
        actions={<span>x</span>}
      />,
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(onRowsChange).toHaveBeenCalledTimes(1);
  });

  it("onRowsChange: догрузка и пустой результат поиска — новые вызовы; ошибка — без вызова", async () => {
    const user = userEvent.setup();
    const list = vi.fn(async (_id: string, q: { page?: number; search?: string }) => {
      if (q.search === "нет") return { data: [], total: 0 };
      if (q.search === "ошибка") throw new Error("boom");
      return q.page === 2 ? { data: [rec(3), rec(4)], total: 4 } : { data: [rec(1), rec(2)], total: 4 };
    });
    const { api } = mockApi({ list });
    const onRowsChange = vi.fn();
    render(
      <FormRecordsPage form={form} schema={schema} api={api} pageSize={2} onRowsChange={onRowsChange} />,
    );
    await screen.findByText("Запись 1");
    // Наблюдатель пересоздаётся после загрузки — сигналим, пока не уйдёт запрос второй порции.
    await waitFor(() => {
      act(() => ioCallback?.([{ isIntersecting: true }]));
      expect(list).toHaveBeenCalledWith("form-1", expect.objectContaining({ page: 2 }));
    });
    await screen.findByText("Запись 3");
    expect(onRowsChange).toHaveBeenCalledTimes(2);
    expect(onRowsChange.mock.calls[1]![0].map((r: FormRecord) => r.id)).toEqual(["r1", "r2", "r3", "r4"]);

    const search = screen.getByPlaceholderText("Поиск по названию");
    await user.type(search, "нет");
    await screen.findByText("Ничего не найдено");
    expect(onRowsChange).toHaveBeenLastCalledWith([]);
    const n = onRowsChange.mock.calls.length;

    await user.clear(search);
    await user.type(search, "ошибка");
    await screen.findByText(/Не удалось загрузить записи/);
    expect(onRowsChange.mock.calls.length).toBeLessThanOrEqual(n + 1);
  });
});
