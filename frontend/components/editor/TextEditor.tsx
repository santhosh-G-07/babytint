"use client";

import { Type } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fontOptionValue, frameFontGroups, parseFontOption } from "@/lib/frame-fonts";
import type { EditorTextState, TextPosition } from "@/types";

export function TextEditor({
  textPositions,
  textState,
  onTextChange,
  onFontChange,
}: {
  textPositions: TextPosition[];
  textState: Record<number, EditorTextState>;
  onTextChange: (textId: number, value: string) => void;
  onFontChange: (textId: number, font: Pick<EditorTextState, "font_family" | "font_weight">) => void;
}) {
  if (textPositions.length === 0) {
    return null;
  }

  return (
    <div className="surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Type className="h-4 w-4 text-amber-700" />
        <div>
          <p className="text-sm text-stone-500 dark:text-stone-400">Birth Details</p>
          <h3 className="font-semibold">Add Text</h3>
        </div>
      </div>
      <div className="space-y-3">
        {textPositions.map((field) => {
          const state = textState[field.text_id];
          const fontOptions = frameFontGroups[field.font_group] ?? frameFontGroups.general;
          const selectedFont = fontOptionValue({
            family: state?.font_family ?? field.font_family,
            weight: state?.font_weight ?? field.font_weight,
          });

          return (
            <div key={field.text_id} className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
              <label className="text-sm font-medium" htmlFor={`text-field-${field.text_id}`}>
                {field.label}
              </label>
              <Input
                id={`text-field-${field.text_id}`}
                className="mt-2"
                value={state?.value ?? ""}
                placeholder={field.placeholder ?? ""}
                onChange={(event) => onTextChange(field.text_id, event.target.value)}
              />
              {field.allow_customer_font ? (
                <Select
                  value={selectedFont}
                  onValueChange={(value) => {
                    const parsed = parseFontOption(value);
                    onFontChange(field.text_id, {
                      font_family: parsed.family,
                      font_weight: parsed.weight,
                    });
                  }}
                >
                  <SelectTrigger className="mt-2 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fontOptions.map((option) => (
                      <SelectItem key={fontOptionValue(option)} value={fontOptionValue(option)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
