import { useEffect, useId, useRef } from "react";

export default function GameOverlay({
  open,
  title,
  subtitle,
  children,
  actions,
  dismissible = false,
  onClose
}) {
  const titleId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");

    if (firstFocusable) {
      firstFocusable.focus();
    } else if (panel) {
      panel.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open || !dismissible || !onClose) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <div className="game-overlay-root" role="presentation">
      <div className="game-overlay-backdrop" aria-hidden="true" />

      <section
        ref={panelRef}
        className="card game-overlay-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="game-overlay-header">
          <h2 id={titleId}>{title}</h2>
          {subtitle ? <p className="subtitle">{subtitle}</p> : null}
        </header>

        <div className="game-overlay-content">{children}</div>

        {actions ? <footer className="game-overlay-actions">{actions}</footer> : null}
      </section>
    </div>
  );
}
