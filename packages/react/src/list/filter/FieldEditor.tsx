import { DateField } from "../../form/DateField.js";
import { MultiCombobox } from "../../form/MultiCombobox.js";
import { Combobox, type ComboboxOption } from "../Combobox.js";
import type { DateRange, FieldType, FilterValue } from "./types.js";
import styles from "./filter.module.css";

interface FieldEditorProps {
  type: FieldType;
  value: FilterValue;
  onChange: (v: FilterValue) => void;
  options?: ComboboxOption[];
  placeholder?: string;
}

/** Рендерит редактор по типу поля. */
export function FieldEditor({
  type,
  value,
  onChange,
  options = [],
  placeholder,
}: FieldEditorProps) {
  switch (type) {
    case "text":
      return (
        <input
          className={styles.formInput}
          placeholder={placeholder ?? "Введите значение"}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "select":
      return (
        <Combobox
          options={options}
          value={typeof value === "string" ? value : ""}
          onChange={(v) => onChange(v)}
          placeholder={placeholder ?? "— любое —"}
        />
      );

    case "multiselect":
      return (
        <MultiCombobox
          options={options}
          values={Array.isArray(value) ? value : []}
          onChange={(v) => onChange(v.length ? v : null)}
          placeholder={placeholder ?? "— любые —"}
        />
      );

    case "daterange": {
      const r: DateRange =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as DateRange)
          : { from: "", to: "" };
      const patch = (p: Partial<DateRange>) => {
        const next = { ...r, ...p };
        onChange(next.from || next.to ? next : null);
      };
      return (
        <div className={styles.filterDaterange}>
          <DateField ariaLabel="С" value={r.from} max={r.to || undefined} onChange={(from) => patch({ from })} />
          <span className={styles.filterDaterangeDash}>—</span>
          <DateField ariaLabel="По" value={r.to} min={r.from || undefined} onChange={(to) => patch({ to })} />
        </div>
      );
    }

    case "boolean": {
      // Поле с выбором из значений — выпадающим списком (общий Combobox).
      // «— любое —» (пустое) = null/не фильтруем; Да = true, Нет = false.
      const v: boolean | null = typeof value === "boolean" ? value : null;
      return (
        <Combobox
          options={[
            { value: "true", label: "Да" },
            { value: "false", label: "Нет" },
          ]}
          value={v === null ? "" : v ? "true" : "false"}
          onChange={(s) => onChange(s === "" ? null : s === "true")}
          placeholder={placeholder ?? "— любое —"}
        />
      );
    }

    default:
      return null;
  }
}

export default FieldEditor;
