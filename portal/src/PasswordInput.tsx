import React, {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import "./PasswordInput.css";

export type PasswordInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label: string;
  visibilityLabel?: string;
};

/** One real input throughout: toggling never remounts or copies the password. */
export function PasswordInput({
  label,
  visibilityLabel,
  id,
  disabled,
  ...props
}: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id || `password-${generatedId}`;
  const input = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);
  const selection = useRef<{
    start: number | null;
    end: number | null;
    direction: "forward" | "backward" | "none" | null;
    focused: boolean;
  } | null>(null);
  const action = `${visible ? "Hide" : "Show"} ${visibilityLabel || label.toLowerCase()}`;

  useLayoutEffect(() => {
    const previous = selection.current;
    const element = input.current;
    selection.current = null;
    if (!previous || !element) return;
    if (previous.focused) element.focus({ preventScroll: true });
    if (previous.start !== null && previous.end !== null)
      element.setSelectionRange(
        previous.start,
        previous.end,
        previous.direction || "none",
      );
  }, [visible]);

  return (
    <div className="password-field">
      <label htmlFor={inputId}>{label}</label>
      <div className="password-control">
        <input
          {...props}
          ref={input}
          id={inputId}
          type={visible ? "text" : "password"}
          disabled={disabled}
        />
        <button
          className="password-toggle"
          type="button"
          aria-label={action}
          title={action}
          aria-controls={inputId}
          aria-pressed={visible}
          disabled={disabled}
          onPointerDown={(event) => {
            // A pointer click on the eye must not move a user's caret away from
            // the field. Keyboard users can still Tab to and activate the eye.
            if (document.activeElement === input.current)
              event.preventDefault();
          }}
          onClick={() => {
            const element = input.current;
            if (!element) return;
            selection.current = {
              start: element.selectionStart,
              end: element.selectionEnd,
              direction: element.selectionDirection,
              focused: document.activeElement === element,
            };
            setVisible((value) => !value);
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="m3 3 18 18" />}
          </svg>
        </button>
      </div>
    </div>
  );
}
