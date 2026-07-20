"use client";

import { useRef, useState } from "react";
import { Type } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fontOptionValue, frameFontGroups, parseFontOption } from "@/lib/frame-fonts";
import type { EditorTextState, TextAlign, TextPosition } from "@/types";

export function TextEditor({
  textPositions,
  textState,
  selectedTextId,
  onSelectText,
  onTextChange,
  onFontChange,
  onStyleChange,
  onRangeStyle,
  onClearRangeStyle,
}: {
  textPositions: TextPosition[];
  textState: Record<number, EditorTextState>;
  selectedTextId: number | null;
  onSelectText: (textId: number) => void;
  onTextChange: (textId: number, value: string) => void;
  onFontChange: (textId: number, font: Pick<EditorTextState, "font_family" | "font_weight">) => void;
  onStyleChange: (
    textId: number,
    patch: Partial<Pick<EditorTextState, "font_size" | "align" | "line_height" | "letter_spacing" | "color">>,
  ) => void;
  onRangeStyle: (
    textId: number,
    start: number,
    end: number,
    patch: Pick<EditorTextState, "font_family" | "font_weight" | "color" | "font_size">,
  ) => void;
  onClearRangeStyle: (textId: number, start: number, end: number) => void;
}) {
  const textRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const [selections, setSelections] = useState<Record<number, { start: number; end: number }>>({});
  const [rangeStyles, setRangeStyles] = useState<Record<number, { font: string; color: string; size: number }>>({});

  const syncSelection = (textId: number) => {
    const node = textRefs.current[textId];
    if (!node) {
      return;
    }
    setSelections((prev) => ({
      ...prev,
      [textId]: {
        start: node.selectionStart ?? 0,
        end: node.selectionEnd ?? 0,
      },
    }));
  };

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
          const selected = selectedTextId === field.text_id;
          const fontOptions = frameFontGroups[field.font_group] ?? frameFontGroups.general;
          const selectedFont = fontOptionValue({
            family: state?.font_family ?? field.font_family,
            weight: state?.font_weight ?? field.font_weight,
          });
          const currentAlign = (state?.align ?? field.align) as TextAlign;
          const currentSize = state?.font_size ?? field.font_size;
          const currentLineHeight = state?.line_height ?? field.line_height ?? 1.2;
          const currentLetterSpacing = state?.letter_spacing ?? field.letter_spacing ?? 0;
          const currentColor = state?.color ?? field.color;
          const selection = selections[field.text_id] ?? { start: 0, end: 0 };
          const selectedLength = Math.max(0, selection.end - selection.start);
          const partialStyle = rangeStyles[field.text_id] ?? {
            font: selectedFont,
            color: currentColor,
            size: currentSize,
          };

          return (
            <div
              key={field.text_id}
              className={`rounded-lg border p-3 transition ${
                selected
                  ? "border-amber-500 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-900/20"
                  : "border-stone-200 dark:border-stone-800"
              }`}
            >
              <button
                type="button"
                className="w-full text-left text-sm font-medium"
                onClick={() => onSelectText(field.text_id)}
              >
                {field.label}
              </button>
              <Textarea
                id={`text-field-${field.text_id}`}
                className="mt-2 min-h-[78px]"
                value={state?.value ?? ""}
                placeholder={field.placeholder ?? ""}
                ref={(node) => {
                  textRefs.current[field.text_id] = node;
                }}
                onFocus={() => {
                  onSelectText(field.text_id);
                  syncSelection(field.text_id);
                }}
                onSelect={() => syncSelection(field.text_id)}
                onMouseUp={() => syncSelection(field.text_id)}
                onKeyUp={() => syncSelection(field.text_id)}
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
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min={8}
                  max={280}
                  placeholder="Size"
                  value={currentSize}
                  onFocus={() => onSelectText(field.text_id)}
                  onChange={(event) =>
                    onStyleChange(field.text_id, {
                      font_size: Math.max(8, Math.min(280, Number(event.target.value) || 8)),
                    })}
                />
                <Select
                  value={currentAlign}
                  onValueChange={(align: TextAlign) => {
                    onStyleChange(field.text_id, { align });
                  }}
                >
                  <SelectTrigger className="h-9" onFocus={() => onSelectText(field.text_id)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0.8}
                  max={3}
                  step={0.05}
                  placeholder="Line Height"
                  value={currentLineHeight}
                  onFocus={() => onSelectText(field.text_id)}
                  onChange={(event) =>
                    onStyleChange(field.text_id, {
                      line_height: Math.max(0.8, Math.min(3, Number(event.target.value) || 1.2)),
                    })}
                />
                <Input
                  type="number"
                  min={-2}
                  max={40}
                  step={0.25}
                  placeholder="Letter Spacing"
                  value={currentLetterSpacing}
                  onFocus={() => onSelectText(field.text_id)}
                  onChange={(event) =>
                    onStyleChange(field.text_id, {
                      letter_spacing: Math.max(-2, Math.min(40, Number(event.target.value) || 0)),
                    })}
                />
                <Input
                  className="col-span-2 h-9 p-1"
                  type="color"
                  value={currentColor}
                  onFocus={() => onSelectText(field.text_id)}
                  onChange={(event) => onStyleChange(field.text_id, { color: event.target.value })}
                />
              </div>
              {selected ? (
                <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                  Drag or resize on canvas. Double-click text on preview to type there directly.
                </p>
              ) : null}
              <div className="mt-3 rounded-md border border-stone-200 p-2 dark:border-stone-700">
                <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  Partial Text Style
                </p>
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                  Select words in the text area, then apply style.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Select
                    value={partialStyle.font}
                    onValueChange={(value) =>
                      setRangeStyles((prev) => ({
                        ...prev,
                        [field.text_id]: {
                          ...partialStyle,
                          font: value,
                        },
                      }))
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontOptions.map((option) => (
                        <SelectItem key={`range-${field.text_id}-${fontOptionValue(option)}`} value={fontOptionValue(option)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-9 p-1"
                    type="color"
                    value={partialStyle.color}
                    onChange={(event) =>
                      setRangeStyles((prev) => ({
                        ...prev,
                        [field.text_id]: {
                          ...partialStyle,
                          color: event.target.value,
                        },
                      }))
                    }
                  />
                  <Input
                    type="number"
                    min={8}
                    max={280}
                    value={partialStyle.size}
                    onChange={(event) =>
                      setRangeStyles((prev) => ({
                        ...prev,
                        [field.text_id]: {
                          ...partialStyle,
                          size: Math.max(8, Math.min(280, Number(event.target.value) || 8)),
                        },
                      }))
                    }
                  />
                  <div className="flex items-center text-xs text-stone-500 dark:text-stone-400">
                    {selectedLength > 0 ? `${selectedLength} chars selected` : "Select text first"}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    disabled={selectedLength === 0}
                    onClick={() => {
                      if (selectedLength === 0) {
                        return;
                      }
                      const parsed = parseFontOption(partialStyle.font);
                      onRangeStyle(field.text_id, selection.start, selection.end, {
                        font_family: parsed.family,
                        font_weight: parsed.weight,
                        color: partialStyle.color,
                        font_size: partialStyle.size,
                      });
                    }}
                  >
                    Style Selected
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    disabled={selectedLength === 0}
                    onClick={() => onClearRangeStyle(field.text_id, selection.start, selection.end)}
                  >
                    Clear Selected Style
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
