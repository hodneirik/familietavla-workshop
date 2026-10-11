import type { HTMLAttributes } from "react";

interface KortProps extends HTMLAttributes<HTMLElement> {
  /** Hvilket HTML-element kortet er. Bruk «li» i lister og «section» for en egen del. */
  som?: "div" | "section" | "article" | "li";
  /** Litt dypere skygge, for kort som kan trykkes på. */
  løft?: boolean;
}

export function Kort({ som: Element = "div", løft, className, ...rest }: KortProps) {
  return (
    <Element
      className={["kort", løft ? "kort--lopt" : "", className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}
