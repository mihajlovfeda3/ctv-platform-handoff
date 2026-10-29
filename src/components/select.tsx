"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

/** Shared, keyboard-accessible selection surface; values stay owned by the caller. */
export function Select({
  label,
  value,
  items,
  onValueChange,
  disabled,
  invalid,
  describedBy,
}: {
  label: string;
  value: string;
  items: { id: string; name: string }[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const anchorTop = useRef(0);
  const [position, setPosition] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
  } | null>(null);
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(0);
  const searchable = items.length >= 8;
  const filtered = items.filter((item) =>
    item.name.toLocaleLowerCase("ru").includes(term.toLocaleLowerCase("ru")),
  );
  const open = position !== null;
  function close(restoreFocus = false) {
    setPosition(null);
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  }
  function show() {
    const rect = trigger.current!.getBoundingClientRect();
    anchorTop.current = rect.top;
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const upwards = below < 250 && above > below;
    const width = Math.min(
      window.innerWidth - 24,
      Math.max(rect.width, searchable ? 360 : 180),
    );
    setTerm("");
    setActive(
      Math.max(
        0,
        items.findIndex((i) => i.id === value),
      ),
    );
    setPosition({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      width,
      ...(upwards
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
      maxHeight: Math.min(360, Math.max(120, upwards ? above : below)),
    });
  }
  function choose(index: number) {
    if (!filtered[index]) return;
    onValueChange(filtered[index].id);
    close(true);
  }
  function keys(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "Tab") {
      // Continue the regular tab order from the originating control.
      close(true);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((n) =>
        Math.max(
          0,
          Math.min(filtered.length - 1, n + (e.key === "ArrowDown" ? 1 : -1)),
        ),
      );
    } else if (e.key === "Enter" || (e.key === " " && !searchable)) {
      e.preventDefault();
      choose(active);
    } else if (!searchable && (e.key === "Home" || e.key === "End")) {
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : filtered.length - 1);
    }
  }
  useEffect(() => {
    if (!open) return;
    (searchable ? search.current : list.current)?.focus({
      preventScroll: true,
    });
    const outside = (e: PointerEvent) => {
      if (
        !popup.current?.contains(e.target as Node) &&
        !trigger.current?.contains(e.target as Node)
      )
        setPosition(null);
    };
    const reposition = (e: Event) => {
      if (
        e.type === "resize" ||
        (!popup.current?.contains(e.target as Node) &&
          Math.abs(
            (trigger.current?.getBoundingClientRect().top ?? 0) -
              anchorTop.current,
          ) > 1)
      )
        setPosition(null);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, searchable]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-option-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);
  return (
    <div className="ctv-select">
      <button
        ref={trigger}
        type="button"
        className="ctv-select-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        data-invalid={invalid}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
          }
        }}
      >
        <span>{items.find((i) => i.id === value)?.name ?? "—"}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {position &&
        createPortal(
          <div
            className="ctv-select-popover"
            ref={popup}
            style={position}
            onKeyDown={keys}
          >
            {searchable && (
              <div className="ctv-select-search">
                <Search size={15} aria-hidden="true" />
                <input
                  ref={search}
                  role="combobox"
                  aria-label={`Поиск: ${label}`}
                  aria-expanded="true"
                  aria-autocomplete="list"
                  aria-controls={`${id}-list`}
                  aria-activedescendant={
                    filtered[active] ? `${id}-option-${active}` : undefined
                  }
                  placeholder="Найти значение…"
                  value={term}
                  onChange={(e) => {
                    e.stopPropagation();
                    setTerm(e.target.value);
                    setActive(0);
                  }}
                />
              </div>
            )}
            <div
              className="ctv-select-options"
              id={`${id}-list`}
              ref={list}
              role="listbox"
              aria-label={label}
              tabIndex={searchable ? -1 : 0}
              aria-activedescendant={
                filtered[active] ? `${id}-option-${active}` : undefined
              }
            >
              {filtered.map((item, index) => (
                <div
                  key={item.id}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={value === item.id}
                  data-active={index === active}
                  onPointerMove={() => setActive(index)}
                  onClick={() => choose(index)}
                >
                  <span>{item.name}</span>
                  {item.id === value && <Check size={14} aria-hidden="true" />}
                </div>
              ))}
            </div>
            {!filtered.length && (
              <p className="ctv-select-empty" role="status">
                Ничего не найдено
              </p>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
