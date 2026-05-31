import type { RichTextRun } from "@/types";

interface StyleCell {
  font_family?: string;
  font_weight?: "normal" | "bold";
  color?: string;
  font_size?: number;
}

function stylesEqual(a: StyleCell | undefined, b: StyleCell | undefined) {
  return (
    (a?.font_family ?? undefined) === (b?.font_family ?? undefined) &&
    (a?.font_weight ?? undefined) === (b?.font_weight ?? undefined) &&
    (a?.color ?? undefined) === (b?.color ?? undefined) &&
    (a?.font_size ?? undefined) === (b?.font_size ?? undefined)
  );
}

function isEmptyStyle(style: StyleCell | undefined) {
  if (!style) {
    return true;
  }
  return (
    !style.font_family &&
    !style.font_weight &&
    !style.color &&
    style.font_size === undefined
  );
}

function clampRange(start: number, end: number, length: number) {
  const safeStart = Math.max(0, Math.min(length, Math.floor(start)));
  const safeEnd = Math.max(0, Math.min(length, Math.floor(end)));
  if (safeEnd <= safeStart) {
    return null;
  }
  return { start: safeStart, end: safeEnd };
}

function toStyleArray(textLength: number, runs: RichTextRun[] | undefined) {
  const styles: Array<StyleCell | undefined> = Array.from({ length: textLength }, () => undefined);
  for (const run of runs ?? []) {
    const clamped = clampRange(run.start, run.end, textLength);
    if (!clamped) {
      continue;
    }
    const patch: StyleCell = {
      font_family: run.font_family,
      font_weight: run.font_weight,
      color: run.color,
      font_size: run.font_size,
    };
    if (isEmptyStyle(patch)) {
      continue;
    }
    for (let index = clamped.start; index < clamped.end; index += 1) {
      styles[index] = {
        ...(styles[index] ?? {}),
        ...patch,
      };
    }
  }
  return styles;
}

function fromStyleArray(styles: Array<StyleCell | undefined>) {
  const runs: RichTextRun[] = [];
  let start = -1;
  let current: StyleCell | undefined;

  for (let index = 0; index <= styles.length; index += 1) {
    const style = index < styles.length ? styles[index] : undefined;
    if (stylesEqual(current, style)) {
      continue;
    }

    if (start >= 0 && current && !isEmptyStyle(current)) {
      runs.push({
        start,
        end: index,
        font_family: current.font_family,
        font_weight: current.font_weight,
        color: current.color,
        font_size: current.font_size,
      });
    }

    start = style ? index : -1;
    current = style;
  }

  return runs;
}

export function normalizeRichRuns(text: string, runs: RichTextRun[] | undefined) {
  return fromStyleArray(toStyleArray(text.length, runs));
}

export function remapRunsForTextChange(
  prevText: string,
  nextText: string,
  runs: RichTextRun[] | undefined,
) {
  if (!runs?.length || prevText === nextText) {
    return normalizeRichRuns(nextText, runs);
  }

  const prevStyles = toStyleArray(prevText.length, runs);
  const nextStyles: Array<StyleCell | undefined> = Array.from({ length: nextText.length }, () => undefined);

  let prefix = 0;
  while (
    prefix < prevText.length &&
    prefix < nextText.length &&
    prevText.charCodeAt(prefix) === nextText.charCodeAt(prefix)
  ) {
    prefix += 1;
  }

  let prevSuffix = prevText.length;
  let nextSuffix = nextText.length;
  while (
    prevSuffix > prefix &&
    nextSuffix > prefix &&
    prevText.charCodeAt(prevSuffix - 1) === nextText.charCodeAt(nextSuffix - 1)
  ) {
    prevSuffix -= 1;
    nextSuffix -= 1;
  }

  for (let index = 0; index < prefix; index += 1) {
    nextStyles[index] = prevStyles[index];
  }

  const tailLength = prevText.length - prevSuffix;
  for (let tail = 0; tail < tailLength; tail += 1) {
    nextStyles[nextSuffix + tail] = prevStyles[prevSuffix + tail];
  }

  return fromStyleArray(nextStyles);
}

export function applyStyleToRange(
  text: string,
  runs: RichTextRun[] | undefined,
  start: number,
  end: number,
  patch: StyleCell,
) {
  const clamped = clampRange(start, end, text.length);
  if (!clamped) {
    return normalizeRichRuns(text, runs);
  }
  const styles = toStyleArray(text.length, runs);
  for (let index = clamped.start; index < clamped.end; index += 1) {
    styles[index] = {
      ...(styles[index] ?? {}),
      ...patch,
    };
  }
  return fromStyleArray(styles);
}

export function clearStyleFromRange(
  text: string,
  runs: RichTextRun[] | undefined,
  start: number,
  end: number,
) {
  const clamped = clampRange(start, end, text.length);
  if (!clamped) {
    return normalizeRichRuns(text, runs);
  }
  const styles = toStyleArray(text.length, runs);
  for (let index = clamped.start; index < clamped.end; index += 1) {
    styles[index] = undefined;
  }
  return fromStyleArray(styles);
}

export function styleAtIndex(text: string, runs: RichTextRun[] | undefined, index: number) {
  if (!text.length) {
    return undefined;
  }
  const safeIndex = Math.max(0, Math.min(text.length - 1, Math.floor(index)));
  const styles = toStyleArray(text.length, runs);
  return styles[safeIndex];
}
