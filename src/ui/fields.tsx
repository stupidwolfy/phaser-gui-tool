import { useEffect, useState } from 'react';
import { useEditorStore } from '../core/store';

/**
 * Inspector field primitives.
 *
 * Each field opens a store transaction on focus and closes it on blur, so a
 * field the user types six characters into produces one undo step rather than
 * six. They also keep local draft text while focused — binding an <input>
 * straight to a committed number makes it impossible to clear the box or type
 * a leading "-".
 */

interface FieldProps<T> {
  label: string;
  value: T;
  onChange: (value: T) => void;
}

function useTransactionHandlers() {
  const begin = useEditorStore((s) => s.beginTransaction);
  const end = useEditorStore((s) => s.endTransaction);
  return { onFocus: begin, onBlur: end };
}

export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: FieldProps<number> & { step?: number; min?: number; max?: number }) {
  const tx = useTransactionHandlers();
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  // Track external changes (dragging on canvas, undo) unless we're mid-edit.
  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        className="field__input"
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={draft}
        onFocus={() => {
          setFocused(true);
          tx.onFocus();
        }}
        onBlur={() => {
          setFocused(false);
          setDraft(String(value));
          tx.onBlur();
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          const parsed = Number.parseFloat(event.target.value);
          if (!Number.isNaN(parsed)) onChange(parsed);
        }}
      />
    </label>
  );
}

export function TextField({ label, value, onChange }: FieldProps<string>) {
  const tx = useTransactionHandlers();
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        className="field__input"
        type="text"
        value={value}
        onFocus={tx.onFocus}
        onBlur={tx.onBlur}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function ColorField({ label, value, onChange }: FieldProps<string>) {
  const tx = useTransactionHandlers();
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="field__color">
        <input
          className="field__swatch"
          type="color"
          value={value}
          onFocus={tx.onFocus}
          onBlur={tx.onBlur}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          className="field__input"
          type="text"
          value={value}
          onFocus={tx.onFocus}
          onBlur={tx.onBlur}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}

/**
 * A picker over a fixed set of options — the parent container, so far.
 *
 * No transaction wrapper, for the same reason as the checkbox: choosing an
 * option is one edit, and so already one undo step.
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
}: FieldProps<string> & { options: { value: string; label: string }[] }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <select
        className="field__input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * A boolean toggle. No transaction wrapper: a checkbox produces exactly one
 * edit per press, so it is already one undo step.
 */
export function CheckboxField({ label, value, onChange }: FieldProps<boolean>) {
  return (
    <label className="field field--check">
      <input
        className="field__check"
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="field__label">{label}</span>
    </label>
  );
}
