"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchDestinations } from "@/lib/destinations";

// ARIA 1.2 "combobox with list autocomplete" pattern:
// https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
//
//   input:  role="combobox", aria-expanded, aria-controls, aria-activedescendant
//   listbox: role="listbox"
//   options: role="option", each with a stable id the input references
//
// Kept as one component (not split input/listbox) because the two are
// never useful apart — the combobox pattern only works as a matched pair.

interface DestinationAutocompleteProps {
  name: string;
  defaultValue?: string;
  required?: boolean;
  onSelect?: (value: string) => void;
}

export function DestinationAutocomplete({
  name,
  defaultValue = "",
  required,
  onSelect,
}: DestinationAutocompleteProps) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Set on an option's onMouseDown so the input's onBlur (which fires
  // first) doesn't close the list before the option's onClick runs.
  const selectingRef = useRef(false);

  const listboxId = useId();
  const helpId = useId();

  const results = open ? searchDestinations(value) : [];

  // Close on outside click. A document-level listener rather than
  // onBlur, so clicking an option (which is inside containerRef) never
  // races against closing the list.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setHighlight(-1);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function commit(destination: string) {
    setValue(destination);
    setOpen(false);
    setHighlight(-1);
    onSelect?.(destination);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      setHighlight(0);
      e.preventDefault();
      return;
    }
    if (!open) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlight((i) => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlight((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        // While the listbox is open, Enter belongs to the combobox, never
        // to the surrounding <form> — otherwise typing a destination the
        // catalog doesn't know ("tun") and hitting Enter submits the
        // half-typed value and navigates away mid-thought. Always swallow
        // it here: pick the highlighted option if there is one, otherwise
        // just close the list so a second Enter submits deliberately.
        e.preventDefault();
        if (highlight >= 0 && results[highlight]) {
          commit(results[highlight]);
        } else {
          setOpen(false);
          setHighlight(-1);
        }
        break;
      case "Escape":
        setOpen(false);
        setHighlight(-1);
        break;
      case "Tab":
        setOpen(false);
        setHighlight(-1);
        break;
    }
  }

  const activeOptionId =
    highlight >= 0 && results[highlight] ? `${listboxId}-option-${highlight}` : undefined;

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        name={name}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-autocomplete="list"
        aria-describedby={helpId}
        autoComplete="off"
        required={required}
        value={value}
        placeholder="Paris, France"
        className="w-full rounded border border-border bg-surface px-4 py-3 font-display text-base font-semibold text-accent outline-none transition-shadow placeholder:font-normal placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/10"
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => {
          if (value.trim()) setOpen(true);
        }}
        onBlur={() => {
          // Deferred: if an option's onMouseDown just fired, its onClick
          // hasn't run yet, so bail out and let commit() close the list.
          setTimeout(() => {
            if (!selectingRef.current) {
              setOpen(false);
              setHighlight(-1);
            }
            selectingRef.current = false;
          }, 0);
        }}
        onKeyDown={handleKeyDown}
      />
      <span id={helpId} className="sr-only">
        Type to search destinations. Use the arrow keys to browse suggestions and Enter to select.
      </span>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Matching destinations"
          className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-md bg-surface py-1 shadow-float ring-1 ring-border"
        >
          {results.length === 0 ? (
            <li role="status" className="px-4 py-3 text-sm text-muted">
              No matching destinations
            </li>
          ) : (
            results.map((destination, i) => (
              <li
                key={destination}
                id={`${listboxId}-option-${i}`}
                role="option"
                aria-selected={i === highlight}
                onMouseDown={() => {
                  selectingRef.current = true;
                }}
                onClick={() => commit(destination)}
                onMouseEnter={() => setHighlight(i)}
                className={`cursor-pointer px-4 py-2.5 text-sm transition-colors ${
                  i === highlight ? "bg-accent-soft text-accent" : "hover:bg-accent-soft/60"
                }`}
              >
                {destination}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
