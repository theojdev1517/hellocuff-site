import React, { useId } from "react";
import { passwordPolicy, passwordRequirements } from "./password-policy";
import { PasswordInput } from "./PasswordInput";

export function PasswordFields({
  password,
  confirmation,
  onPassword,
  onConfirmation,
  prefix = "",
  disabled = false,
}: {
  password: string;
  confirmation: string;
  onPassword: (value: string) => void;
  onConfirmation: (value: string) => void;
  prefix?: string;
  disabled?: boolean;
}) {
  const checklistId = `password-checklist-${useId()}`;
  const confirmationId = `password-confirmation-${useId()}`;
  return (
    <>
      <PasswordInput
        label={prefix ? "New password" : "Password"}
        name="password"
        autoComplete="new-password"
        minLength={passwordPolicy.minLength}
        maxLength={passwordPolicy.maxLength}
        value={password}
        onChange={(event) => onPassword(event.target.value)}
        required
        disabled={disabled}
        aria-describedby={checklistId}
      />
      <ul
        id={checklistId}
        className="password-checklist"
        aria-label="Password requirements"
        aria-live="polite"
      >
        {passwordRequirements(password).map((entry) => (
          <li
            key={entry.id}
            data-met={entry.met}
            className={entry.met ? "met" : "unmet"}
          >
            <span aria-hidden="true">{entry.met ? "✓" : "○"}</span>
            <span>
              {entry.label}
              <span className="sr-only">
                {entry.met ? " - met" : " - not met"}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <PasswordInput
        label={prefix ? "Confirm new password" : "Confirm password"}
        visibilityLabel={
          prefix ? "new password confirmation" : "password confirmation"
        }
        name="confirmation"
        autoComplete="new-password"
        minLength={passwordPolicy.minLength}
        maxLength={passwordPolicy.maxLength}
        value={confirmation}
        onChange={(event) => onConfirmation(event.target.value)}
        required
        disabled={disabled}
        aria-invalid={confirmation.length > 0 && password !== confirmation}
        aria-describedby={confirmationId}
      />
      <small
        id={confirmationId}
        className={
          confirmation && password !== confirmation ? "field-error" : "hint"
        }
      >
        {confirmation
          ? password === confirmation
            ? "Passwords match."
            : "Passwords do not match."
          : "Enter the same password again."}
      </small>
    </>
  );
}
