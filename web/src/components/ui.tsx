import type { ComponentProps } from "react";

export const card = "rounded-xl border border-border bg-surface p-5";
export const cardFlush =
  "overflow-x-auto rounded-xl border border-border bg-surface";
export const stack = "flex flex-col gap-4";
export const row = "flex flex-wrap items-center gap-2";
export const pageTitle = "text-26 font-bold";
export const cardTitle = "text-16 font-bold";
export const cardLink = "font-semibold text-accent";
export const num = "text-right tabular-nums";
export const errorText = "text-14 text-bad";
export const badge =
  "ml-2 rounded-md bg-border px-1.5 py-0.5 text-11 text-muted";
export const field =
  "rounded-lg border border-border bg-surface px-2.5 py-2 text-14 text-fg";

const buttonVariants = {
  default: "border-border bg-surface text-fg",
  primary: "border-accent bg-accent text-white",
  danger: "border-border bg-surface text-bad",
  ghost: "border-border bg-transparent text-fg",
  sidebar: "border-sidebar-line bg-transparent text-sidebar-fg",
};
export type ButtonVariant = keyof typeof buttonVariants;

const buttonSizes = {
  md: "px-3.5 py-2 text-14",
  sm: "px-2.5 py-1 text-13",
};

export function Button({
  variant = "default",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: keyof typeof buttonSizes;
}) {
  return (
    <button
      className={`cursor-pointer rounded-lg border disabled:cursor-default disabled:opacity-60 ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      {...props}
    />
  );
}

export function Th({
  numeric = false,
  className = "",
  ...props
}: ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      className={`border-b border-border px-4 py-2.5 text-12 font-semibold tracking-[0.04em] text-muted uppercase ${numeric ? num : "text-left"} ${className}`}
      {...props}
    />
  );
}

export function Td({
  numeric = false,
  className = "",
  ...props
}: ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      className={`border-b border-border px-4 py-2.5 [tr:last-child>&]:border-b-0 ${numeric ? num : ""} ${className}`}
      {...props}
    />
  );
}

export const table = "w-full border-collapse text-14";

const meterTones = {
  good: "bg-good",
  near: "bg-warn",
  over: "bg-bad",
  accent: "bg-accent",
};

export function Meter({
  percent,
  tone,
}: {
  percent: number;
  tone: keyof typeof meterTones;
}) {
  return (
    <div className="h-2.5 overflow-hidden rounded-[5px] bg-border">
      <div
        className={`h-full rounded-[5px] ${meterTones[tone]}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
