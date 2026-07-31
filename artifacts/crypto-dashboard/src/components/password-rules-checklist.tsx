import {
  PASSWORD_RULE_LABELS,
  checkPasswordRules,
  type PasswordRuleStatuses,
} from "@/lib/password-policy";

interface Props {
  password: string;
  id?: string;
  className?: string;
}

const RULE_ORDER: (keyof PasswordRuleStatuses)[] = [
  "minLength",
  "mixedClasses",
  "notCommon",
];

export default function PasswordRulesChecklist({ password, id, className }: Props) {
  const statuses = checkPasswordRules(password);
  return (
    <ul
      id={id}
      data-testid="password-rules-checklist"
      className={"mt-2 space-y-1 text-xs " + (className ?? "")}
      aria-label="Password requirements"
    >
      {RULE_ORDER.map((key) => {
        const ok = statuses[key];
        return (
          <li
            key={key}
            data-testid={`password-rule-${key}`}
            data-passed={ok ? "true" : "false"}
            className={
              "flex items-center gap-2 " +
              (ok ? "text-emerald-500" : "text-muted-foreground")
            }
          >
            <span
              aria-hidden="true"
              className={
                "inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold flex-shrink-0 " +
                (ok
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "bg-muted text-muted-foreground")
              }
            >
              {ok ? "✓" : "○"}
            </span>
            <span>{PASSWORD_RULE_LABELS[key]}</span>
            <span className="sr-only">{ok ? " (met)" : " (not met)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
