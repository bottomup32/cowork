import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      className={["button-primary", className].filter(Boolean).join(" ")}
      type={type}
      {...props}
    />
  );
}
