"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseHexColor } from "@/lib/color";

const SWATCHES = ["#16A34A", "#0EA5E9", "#6366F1", "#A855F7", "#F59E0B", "#EF4444", "#64748B", "#005068"];

/** Picker + hex field + quick swatches; empty means "use the default". */
export function ColorInput({
  id,
  name,
  label,
  hint,
  value,
  onChange,
  swatches = false,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  swatches?: boolean;
}) {
  const valid = parseHexColor(value) !== null;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={valid ? value.trim() : "#000000"}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border bg-transparent p-0.5"
        />
        <Input
          id={id}
          name={name}
          placeholder="Default"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono uppercase"
          maxLength={7}
        />
        {value ? (
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange("")} aria-label={`Reset ${label}`}>
            <RotateCcw className="size-4" />
          </Button>
        ) : null}
      </div>
      {swatches ? (
        <div className="flex flex-wrap gap-1.5">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => onChange(swatch)}
              aria-label={`Use ${swatch}`}
              className="size-6 rounded-full border border-white shadow ring-1 ring-slate-200 transition-transform hover:scale-110"
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>
      ) : null}
      {value && !valid ? (
        <p className="text-xs text-destructive">Use a hex colour like #0F766E.</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
