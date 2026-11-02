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
