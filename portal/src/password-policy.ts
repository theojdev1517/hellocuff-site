// Deliberate HelloCuff product policy. Passwords are never trimmed or normalized.
export const passwordPolicy = { minLength: 8, maxLength: 128 } as const;
// Firebase's documented non-alphanumeric set. Other characters are permitted,
// but do not count toward this specific requirement (notably +, -, = and `).
export const passwordSpecialCharacters = "^$*.[]{}()?\"!@#%&/\\,><':;|_~";
export interface PasswordRequirement {
  id: "length" | "lowercase" | "uppercase" | "number" | "special";
  label: string;
  met: boolean;
}
export function passwordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      id: "length",
      label: "8–128 characters",
      met:
        password.length >= passwordPolicy.minLength &&
        password.length <= passwordPolicy.maxLength,
    },
    {
      id: "lowercase",
      label: "A lowercase letter (a–z)",
      met: /[a-z]/.test(password),
    },
    {
      id: "uppercase",
      label: "An uppercase letter (A–Z)",
      met: /[A-Z]/.test(password),
    },
    { id: "number", label: "A number (0–9)", met: /[0-9]/.test(password) },
    {
      id: "special",
      label: "A special character, such as ! @ # or ?",
      met: Array.from(password).some((character) =>
        passwordSpecialCharacters.includes(character),
      ),
    },
  ];
}
export const passwordIssues = (password: string): string[] =>
  passwordRequirements(password)
    .filter((item) => !item.met)
    .map((item) => item.label);
export const passwordsMatch = (
  password: string,
  confirmation: string,
): boolean => password.length > 0 && password === confirmation;
export function validatePassword(
  password: string,
  confirmation?: string,
): string[] {
  const issues = passwordIssues(password).map(
    (issue) => `Password requires ${issue}.`,
  );
  if (confirmation !== undefined && !passwordsMatch(password, confirmation))
    issues.push("Passwords do not match.");
  return issues;
}
// Requirements to mirror in a separately reviewed Firebase password-policy setup.
// This object is documentation/configuration data, not a management API request.
export const firebasePasswordPolicyRequirements = {
  minPasswordLength: passwordPolicy.minLength,
  maxPasswordLength: passwordPolicy.maxLength,
  containsLowercaseCharacter: true,
  containsUppercaseCharacter: true,
  containsNumericCharacter: true,
  containsNonAlphanumericCharacter: true,
} as const;
