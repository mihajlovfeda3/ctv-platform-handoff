"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

type Item = { href: string; label: string; active: boolean };
export function NavigationGroup({
  href,
  label,
  icon: Icon,
  active,
  compact,
  items = [],
  id,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  compact: boolean;
  items?: Item[];
  id?: string;
}) {
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter(),
    [hover, setHover] = useState(false),
    [pinned, setPinned] = useState(false);
  const close = useRef<ReturnType<typeof setTimeout> | null>(null),
    click = useRef<ReturnType<typeof setTimeout> | null>(null);
  const available = !compact && items.length > 0,
    open = available && (hover || pinned);
  useEffect(
    () => () => {
      if (close.current) clearTimeout(close.current);
      if (click.current) clearTimeout(click.current);
    },
    [],
  );
  useEffect(
    () => () => {
      if (click.current) clearTimeout(click.current);
    },
    [pathname],
  );
  const enter = () => {
    if (close.current) clearTimeout(close.current);
    setHover(true);
  };
  const leave = () => {
    if (close.current) clearTimeout(close.current);
    close.current = setTimeout(() => {
      if (!(
        document.activeElement?.matches(":focus-visible") &&
        root.current?.contains(document.activeElement)
      ))
        setHover(false);
    }, 220);
  };
  const pin = () => {
    if (click.current) clearTimeout(click.current);
    setPinned((v) => !v);
  };
  return (
    <div
      ref={root}
      className="nav-row"
      data-pinned={pinned || undefined}
      onPointerEnter={() => {
        if (available) enter();
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "touch") leave();
      }}
      onFocusCapture={(e) => {
        if (available && (e.target as HTMLElement).matches(":focus-visible"))
          enter();
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) leave();
      }}
    >
      <Link
        href={href}
        prefetch={false}
        scroll={false}
        className={`nav-item ${active ? "active" : ""}`}
        aria-label={label}
        title={
          available
            ? `${label}. Двойной щелчок или пробел — ${pinned ? "открепить" : "закрепить"} подразделы`
            : label
        }
        aria-description={
          available
            ? "Enter — перейти; пробел — закрепить или открепить подразделы; стрелка влево — закрыть"
            : undefined
        }
        aria-expanded={available ? open : undefined}
        aria-controls={available ? id : undefined}
        aria-keyshortcuts={
          available ? "Space ArrowRight ArrowLeft Escape" : undefined
        }
        onClick={(e) => {
          if (
            !available ||
            e.detail === 0 ||
            e.ctrlKey ||
            e.metaKey ||
            e.shiftKey ||
            e.altKey ||
            e.button !== 0
          )
            return;
          e.preventDefault();
          if (click.current) clearTimeout(click.current);
          if (e.detail === 1)
            click.current = setTimeout(
              () => router.push(href, { scroll: false }),
              400,
            );
        }}
        onDoubleClick={(e) => {
          if (available) {
            e.preventDefault();
            pin();
          }
        }}
        onKeyDown={(e) => {
          if (!available) return;
          if (e.key === " ") {
            e.preventDefault();
            pin();
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            enter();
          } else if (e.key === "ArrowLeft" || e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setPinned(false);
            setHover(false);
          }
        }}
      >
        <Icon size={19} />
        <span className="nav-label-text">{label}</span>
      </Link>
      {open && (
        <div id={id} className="scenario-subnav">
          {items.map((item) => (
            <Link
              key={item.href}
              onClick={() => {
                if (click.current) clearTimeout(click.current);
              }}
              href={item.href}
              prefetch={false}
              scroll={false}
              aria-label={item.label}
              title={item.label}
              aria-current={item.active ? "page" : undefined}
            >
              <span className="subnav-full">{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
