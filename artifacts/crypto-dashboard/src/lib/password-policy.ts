export const MIN_PASSWORD_LENGTH = 8;

const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  "password",
  "password1",
  "password123",
  "passw0rd",
  "p@ssword",
  "p@ssw0rd",
  "qwerty",
  "qwerty123",
  "qwertyuiop",
  "12345678",
  "123456789",
  "1234567890",
  "11111111",
  "00000000",
  "abc12345",
  "abcd1234",
  "letmein",
  "letmein1",
  "welcome",
  "welcome1",
  "iloveyou",
  "admin123",
  "administrator",
  "monkey123",
  "football",
  "baseball",
  "starwars",
  "trustno1",
  "sunshine",
  "princess",
  "dragon123",
  "master123",
  "superman",
  "batman123",
]);

export type CharClass = "letter" | "digit" | "symbol";

export function getCharClasses(password: string): Set<CharClass> {
  const classes = new Set<CharClass>();
  for (const ch of password) {
    if (/[A-Za-z]/.test(ch)) classes.add("letter");
    else if (/[0-9]/.test(ch)) classes.add("digit");
    else classes.add("symbol");
  }
  return classes;
}

export interface PasswordRuleStatuses {
  minLength: boolean;
  notCommon: boolean;
  mixedClasses: boolean;
}

export const PASSWORD_RULE_LABELS: Record<keyof PasswordRuleStatuses, string> = {
  minLength: `At least ${MIN_PASSWORD_LENGTH} characters`,
  notCommon: "Not a commonly-used password",
  mixedClasses: "Mix at least two of: letters, numbers, symbols",
};

export function checkPasswordRules(password: string): PasswordRuleStatuses {
  return {
    minLength: password.length >= MIN_PASSWORD_LENGTH,
    notCommon: password.length > 0 && !COMMON_PASSWORDS.has(password.toLowerCase()),
    mixedClasses: getCharClasses(password).size >= 2,
  };
}

export interface PasswordValidationResult {
  ok: boolean;
  error?: string;
}

export function validatePassword(password: string): PasswordValidationResult {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return {
      ok: false,
      error: "That password is too common. Please choose a less guessable one.",
    };
  }

  const classes = getCharClasses(password);
  if (classes.size < 2) {
    return {
      ok: false,
      error:
        "Password must mix at least two of: letters, numbers, and symbols.",
    };
  }

  return { ok: true };
}

export interface PasswordStrengthHint {
  level: "weak" | "fair" | "strong";
  message: string;
}

export function getPasswordStrengthHint(
  password: string,
): PasswordStrengthHint | null {
  if (password.length === 0) return null;

  if (password.length < MIN_PASSWORD_LENGTH) {
    const remaining = MIN_PASSWORD_LENGTH - password.length;
    return {
      level: "weak",
      message: `Add ${remaining} more character${remaining === 1 ? "" : "s"} to reach ${MIN_PASSWORD_LENGTH}.`,
    };
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return {
      level: "weak",
      message: "This password is on a common-passwords list — try something less guessable.",
    };
  }

  const classes = getCharClasses(password);
  if (classes.size < 2) {
    return {
      level: "weak",
      message: "Mix in numbers or symbols to make it harder to guess.",
    };
  }

  if (classes.size === 2 && password.length < 12) {
    return {
      level: "fair",
      message: "Looks okay. Add length or another character type for extra strength.",
    };
  }

  return {
    level: "strong",
    message: "Strong password.",
  };
}
