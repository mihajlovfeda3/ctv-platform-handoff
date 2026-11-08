"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./scenario-cards.module.css";

export function ScenarioDescription({ text }: { text: string }) {
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [long, setLong] = useState(false);
  useEffect(() => {
    const el = paragraph.current;
    if (!el) return;
    const measure = () =>
      setLong(
        el.scrollHeight > parseFloat(getComputedStyle(el).lineHeight) * 4 + 2,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);
  return (
    <div className={styles.description}>
      <p
        ref={paragraph}
        className={`inspector-description ${styles.text}`}
        data-expanded={expanded}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          className={styles.descriptionToggle}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Свернуть описание" : "Развернуть описание"}
        </button>
      )}
    </div>
  );
}
