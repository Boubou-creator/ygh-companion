'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a,input,select,[tabindex="0"]',
        ) || [],
      );
    focusable()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const nodes = focusable(),
        first = nodes[0],
        last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, []);
  return (
    <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-title">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" aria-label="Fermer la fenêtre" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
  );
}
