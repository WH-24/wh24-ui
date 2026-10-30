import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { folderView, ListPage, type ListGroups } from "./ListPage";
import type { FilterBarConfig } from "./filter/types";

interface Row {
  id: string;
  name: string;
  folder: string;
}

const rows: Row[] = [
  { id: "1", name: "Обложка А", folder: "cover" },
  { id: "2", name: "Про бюро", folder: "about" },
  { id: "3", name: "Обложка Б", folder: "cover" },
  { id: "4", name: "Без места", folder: "gone" },
];

const filterConfig: FilterBarConfig<Row> = {
  scope: "groups-test",
  search: { placeholder: "Поиск", get: (r) => r.name },
  fields: [],
};

const folders = [
  { key: "cover", label: "Обложка" },
  { key: "about", label: "О нас" },
  { key: "empty", label: "Пустая" },
];

beforeEach(() => localStorage.clear());

describe("folderView", () => {
  const g: ListGroups<Row> = { items: folders, get: (r) => r.folder };

  it("в корне — все папки по порядку и строки без папки", () => {
    const v = folderView(rows, g, null, false);
    expect(v.folders.map((f) => [f.group.key, f.rows.length])).toEqual([
      ["cover", 2],
      ["about", 1],
      ["empty", 0],
    ]);
    expect(v.rows.map((r) => r.id)).toEqual(["4"]);
  });

  it("в открытой папке — только её строки", () => {
    const v = folderView(rows, g, "cover", false);
    expect(v.folders).toEqual([]);
    expect(v.rows.map((r) => r.id)).toEqual(["1", "3"]);
  });

  it("поиск в корне — плоский список найденного во всех папках", () => {
    const v = folderView([rows[0], rows[1]], g, null, true);
    expect(v.folders).toEqual([]);
    expect(v.rows.map((r) => r.id)).toEqual(["1", "2"]);
  });
});

function renderFolders(extra: Partial<ListGroups<Row>> = {}) {
  return render(
    <ListPage<Row>
      title="Слайды"
      data={rows}
      getId={(r) => r.id}
      columns={[
        { key: "name", label: "Название", render: (r) => r.name },
        { key: "size", label: "Размер", render: () => "1 КБ" },
      ]}
      filterConfig={filterConfig}
      renderCard={(r) => <div>card {r.name}</div>}
      groups={{
        items: folders,
        get: (r) => r.folder,
        folderCells: (_g, rs) => ({ size: `${rs.length} шт.` }),
        ...extra,
      }}
    />,
  );
}

describe("ListPage с папками", () => {
  it("в корне — строки-папки со сводкой, слайды папок спрятаны", () => {
    renderFolders();
    expect(screen.getByRole("button", { name: "Обложка" })).toBeInTheDocument();
    expect(screen.getByText("2 шт.")).toBeInTheDocument();
    expect(screen.getByText("0 шт.")).toBeInTheDocument();
    expect(screen.queryByText("Обложка А")).not.toBeInTheDocument();
    expect(screen.getByText("Без места")).toBeInTheDocument();
    // Строки-сводки под папками нет (владелец, 30.10.2026).
    expect(screen.queryByText(/Папок:/)).not.toBeInTheDocument();
  });

  it("клик по папке открывает её, крошки возвращают в корень", async () => {
    const onOpenChange = vi.fn();
    renderFolders({ onOpenChange });
    await userEvent.click(screen.getByRole("button", { name: "Обложка" }));
    expect(onOpenChange).toHaveBeenLastCalledWith("cover");
    expect(screen.getByText("Обложка А")).toBeInTheDocument();
    expect(screen.getByText("Обложка Б")).toBeInTheDocument();
    expect(screen.queryByText("Без места")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Слайды/ }));
    expect(onOpenChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByText("Обложка А")).not.toBeInTheDocument();
  });

  it("пустая папка так и говорит", async () => {
    renderFolders({ onMove: () => {} });
    await userEvent.click(screen.getByRole("button", { name: "Пустая" }));
    expect(screen.getByText("Папка пуста")).toBeInTheDocument();
  });

  it("действия папки — в строке, но не у строк без папки", () => {
    renderFolders({ renderActions: (g) => <button>меню {g.label}</button> });
    expect(screen.getByText("меню Обложка")).toBeInTheDocument();
    expect(screen.getAllByText(/^меню /)).toHaveLength(3);
  });

  it("перетаскивание строки на папку зовёт onMove", async () => {
    const onMove = vi.fn();
    const { container } = renderFolders({ onMove });
    const row = screen.getByText("Без места").closest("tr")!;
    expect(row).toHaveAttribute("draggable", "true");
    const store = new Map<string, string>();
    const dataTransfer = {
      setData: (t: string, v: string) => store.set(t, v),
      getData: (t: string) => store.get(t) ?? "",
      get types() {
        return [...store.keys()];
      },
      effectAllowed: "",
      dropEffect: "",
    };
    fireEvent.dragStart(row, { dataTransfer });
    const target = container.querySelectorAll("tr")[3]; // thead, cover, about, empty
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(onMove).toHaveBeenCalledWith(rows[3], "empty");
  });

  it("в открытой папке, пока тащат строку, появляется лента других папок", async () => {
    const onMove = vi.fn();
    renderFolders({ onMove });
    await userEvent.click(screen.getByRole("button", { name: "Обложка" }));
    const row = screen.getByText("Обложка А").closest("tr")!;
    const store = new Map<string, string>();
    const dataTransfer = {
      setData: (t: string, v: string) => store.set(t, v),
      getData: (t: string) => store.get(t) ?? "",
      get types() {
        return [...store.keys()];
      },
      effectAllowed: "",
      dropEffect: "",
    };
    expect(screen.queryByText("Переложить в:")).not.toBeInTheDocument();
    fireEvent.dragStart(row, { dataTransfer });
    expect(screen.getByText("Переложить в:")).toBeInTheDocument();
    // Своей папки в ленте нет.
    const chip = screen.getByText("О нас");
    expect(screen.getByText("Переложить в:").parentElement!.textContent).toBe(
      "Переложить в:О насПустая",
    );
    fireEvent.dragOver(chip, { dataTransfer });
    fireEvent.drop(chip, { dataTransfer });
    expect(onMove).toHaveBeenCalledWith(rows[0], "about");
    expect(screen.queryByText("Переложить в:")).not.toBeInTheDocument();
  });

  it("без onMove строки не перетаскиваются", () => {
    renderFolders();
    expect(screen.getByText("Без места").closest("tr")).not.toHaveAttribute("draggable");
  });

  it("в карточках — плитки-папки, клик открывает", async () => {
    renderFolders({ describe: (_g, rs) => `${rs.length} слайда` });
    await userEvent.click(screen.getByTitle("Карточки"));
    expect(screen.getByText("2 слайда")).toBeInTheDocument();
    expect(screen.queryByText("card Обложка А")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Открыть папку «Обложка»" }));
    expect(screen.getByText("card Обложка А")).toBeInTheDocument();
  });
});
