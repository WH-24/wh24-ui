import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Combobox } from "./Combobox";

// Метка варианта (поле «Выбор» в «Формах»): иконка цветом варианта или кружок.

const options = [
  { value: "hot", label: "Горячий", color: "#e5484d", icon: <i data-testid="flame" /> },
  { value: "cold", label: "Холодный", color: "#0090ff" },
  { value: "none", label: "Без метки" },
];

describe("Combobox: метка варианта", () => {
  it("у выбранного значения — иконка цветом варианта", () => {
    render(<Combobox options={options} value="hot" onChange={() => {}} />);
    const icon = screen.getByTestId("flame").parentElement!;
    expect(icon.style.color).toMatch(/e5484d|229, 72, 77/);
  });

  it("в списке: иконка, кружок без иконки, без метки — ничего", async () => {
    render(<Combobox options={options} value="" onChange={() => {}} />);
    await userEvent.click(screen.getByRole("combobox"));
    const rows = screen.getAllByRole("option");
    expect(rows[0].querySelector("[data-testid=flame]")).toBeTruthy();
    const dot = rows[1].querySelector("span[aria-hidden]") as HTMLElement;
    expect(dot.style.background).toMatch(/0090ff|0, 144, 255/);
    expect(rows[2].querySelector("span[aria-hidden]")).toBeNull();
  });
});

// Клавиатура (окно «Участники пространства», 12.11.2026): Enter на поле с
// выбранным значением выдавал первый вариант — «Администратора».
const roles = [
  { value: "admin", label: "Администратор" },
  { value: "member", label: "Участник" },
  { value: "viewer", label: "Наблюдатель" },
];

describe("Combobox: клавиатура", () => {
  it("Enter без выбора стрелками оставляет текущее значение", async () => {
    const changes: string[] = [];
    render(<Combobox options={roles} value="member" onChange={(v) => changes.push(v)} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.keyboard("{Enter}");
    expect(changes).toEqual([]);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("стрелки подсвечивают вариант, Enter выбирает подсвеченный", async () => {
    const changes: string[] = [];
    render(<Combobox options={roles} value="member" onChange={(v) => changes.push(v)} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.keyboard("{ArrowDown}");
    const input = screen.getByRole("combobox");
    const activeId = input.getAttribute("aria-activedescendant");
    expect(document.getElementById(activeId!)?.textContent).toBe("Наблюдатель");
    await userEvent.keyboard("{Enter}");
    expect(changes).toEqual(["viewer"]);
  });

  it("Escape в открытом списке помечен обработанным — окно вокруг не закрывается", async () => {
    let outside = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) outside++;
    };
    document.addEventListener("keydown", onKey);
    render(<Combobox options={roles} value="member" onChange={() => {}} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(outside).toBe(0);
    // Закрытый список Escape не глотает.
    await userEvent.keyboard("{Escape}");
    expect(outside).toBe(1);
    document.removeEventListener("keydown", onKey);
  });
});
