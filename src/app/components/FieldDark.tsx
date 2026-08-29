/**
 * Dark-surface text field (Auth + Signup): label, leading icon, input,
 * optional trailing node (e.g. "Forgot password?" / show-password toggle).
 */
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

export interface FieldDarkProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: ReactNode;
  /** Slot rendered on the right of the label row (e.g. a "Forgot?" link). */
  labelAside?: ReactNode;
  icon?: ReactNode;
  trailing?: ReactNode;
  error?: string | null;
  /** Highlight ring (sun yellow) even when not focused. Used on the "name" step. */
  emphasized?: boolean;
  containerClassName?: string;
}

export const FieldDark = forwardRef<HTMLInputElement, FieldDarkProps>(function FieldDark(
  { label, labelAside, icon, trailing, error, emphasized, containerClassName, id, ...input },
  ref,
) {
  const inputId = id ?? (typeof input.name === "string" ? `field-${input.name}` : undefined);
  return (
    <div className={containerClassName}>
      {(label || labelAside) && (
        <div className="flex items-center justify-between mb-2">
          {label ? (
            <label htmlFor={inputId} className="field-label" style={{ marginBottom: 0 }}>
              {label}
            </label>
          ) : (
            <span />
          )}
          {labelAside}
        </div>
      )}
      <div
        className={`field-dark${error ? " invalid" : ""}`}
        style={emphasized ? { boxShadow: "inset 0 0 0 1.5px var(--color-sun)", height: 56 } : undefined}
      >
        {icon}
        <input ref={ref} id={inputId} aria-invalid={!!error} {...input} />
        {trailing}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

/* Inline icons matching the reference (22×22 viewBox, 1.8 stroke). */
export const MailIcon = () => (
  <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <rect x="2" y="4" width="18" height="14" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3 6l8 5.5L19 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <rect x="4" y="9.5" width="14" height="9.5" rx="3" stroke="currentColor" strokeWidth="1.8" />
    <path d="M7 9.5V7a4 4 0 018 0v2.5" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <circle cx="11" cy="7.5" r="3.7" stroke="currentColor" strokeWidth="1.8" />
    <path d="M4 18.5c1.2-3.3 4-4.8 7-4.8s5.8 1.5 7 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export default FieldDark;
