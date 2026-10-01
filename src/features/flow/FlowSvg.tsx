import type { CSSProperties, KeyboardEvent } from 'react';
import { LAYOUT, type Box, type FlowLayout } from './layout';
import styles from './Flow.module.css';

/** Colours: design tokens on screen (incl. dark mode), fixed print colours in exports. */
const PALETTES = {
  screen: {
    background: 'var(--color-surface-raised)',
    box: 'var(--color-surface-raised)',
    header: 'var(--color-surface)',
    phase: 'var(--color-accent)',
    phaseText: 'var(--color-on-accent)',
    line: 'var(--color-line-strong)',
    text: 'var(--color-text)',
    muted: 'var(--color-text-muted)',
    font: 'var(--font-sans)',
  },
  print: {
    background: '#ffffff',
    box: '#ffffff',
    header: '#e8eced',
    phase: '#1f5f6b',
    phaseText: '#ffffff',
    line: '#1a1d1e',
    text: '#1a1d1e',
    muted: '#4a5356',
    font: "'IBM Plex Sans', Arial, sans-serif",
  },
};

interface Props {
  layout: FlowLayout;
  palette: keyof typeof PALETTES;
  /** Accessible name of the diagram. */
  title: string;
  /** Interactive boxes (screen only): drill-down on click, Enter or Space. */
  onSelect?: (box: Box) => void;
  /** Accessible name of a box button, e.g. "… – show records". */
  boxLabel?: (box: Box) => string;
  /** Embedded @font-face rules for exports. */
  fontCss?: string;
}

export function FlowSvg({ layout, palette, title, onSelect, boxLabel, fontCss }: Props) {
  const p = PALETTES[palette];
  const { LINE_HEIGHT, PAD, FONT_SIZE } = LAYOUT;
  const text: CSSProperties = { fill: p.text, fontFamily: p.font, fontSize: FONT_SIZE };
  const stroke: CSSProperties = { fill: 'none', stroke: p.line, strokeWidth: 1 };
  const interactive = Boolean(onSelect);

  const boxContent = (box: Box) => (
    <>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        style={{ fill: p.box, stroke: p.line, strokeWidth: 1 }}
        className={interactive ? styles.boxRect : undefined}
      />
      <text style={text}>
        {box.lines.map((line, index) => (
          <tspan
            key={index}
            x={box.x + PAD + (line.indent ?? 0) * 12}
            y={box.y + PAD + (index + 1) * LINE_HEIGHT - 4}
            style={line.bold ? { fontWeight: 600 } : undefined}
          >
            {line.text}
          </tspan>
        ))}
      </text>
    </>
  );

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={layout.width}
      height={layout.height}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role={interactive ? 'group' : 'img'}
      aria-label={title}
      className={interactive ? styles.svg : undefined}
    >
      {!interactive && <title>{title}</title>}
      {fontCss && <style>{fontCss}</style>}
      <defs>
        <marker
          id="flow-arrow"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: p.line }} />
        </marker>
      </defs>
      <rect width={layout.width} height={layout.height} style={{ fill: p.background }} />

      <g aria-hidden="true">
        {layout.headers.map((header, index) => (
          <g key={index}>
            <rect
              x={header.x}
              y={header.y}
              width={header.w}
              height={header.h}
              style={{ fill: p.header, stroke: p.line, strokeWidth: 1 }}
            />
            <text style={{ ...text, fontWeight: 600 }} textAnchor="middle">
              {header.lines.map((line, i) => (
                <tspan
                  key={i}
                  x={header.x + header.w / 2}
                  y={
                    header.y +
                    header.h / 2 +
                    (i - (header.lines.length - 1) / 2) * LINE_HEIGHT +
                    FONT_SIZE / 3
                  }
                >
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        ))}
        {layout.phases.map((phase) => {
          const cx = phase.x + phase.w / 2;
          const cy = phase.y + phase.h / 2;
          return (
            <g key={phase.label}>
              <rect
                x={phase.x}
                y={phase.y}
                width={phase.w}
                height={phase.h}
                style={{ fill: p.phase }}
              />
              <text
                transform={`rotate(-90 ${cx} ${cy})`}
                x={cx}
                y={cy + FONT_SIZE / 3}
                textAnchor="middle"
                style={{ ...text, fill: p.phaseText, fontWeight: 600 }}
              >
                {phase.label}
              </text>
            </g>
          );
        })}
        {layout.arrows.map((points, index) => (
          <polyline
            key={index}
            points={points.map(([x, y]) => `${x},${y}`).join(' ')}
            style={stroke}
            markerEnd="url(#flow-arrow)"
          />
        ))}
      </g>

      {layout.boxes.map((box) =>
        interactive && box.targets.length > 0 ? (
          <g
            key={box.id}
            role="button"
            tabIndex={0}
            data-box={box.id}
            aria-label={boxLabel ? boxLabel(box) : box.label}
            className={styles.box}
            onClick={() => onSelect?.(box)}
            onKeyDown={(event: KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect?.(box);
              }
            }}
          >
            {boxContent(box)}
          </g>
        ) : (
          <g key={box.id} data-box={box.id} aria-label={interactive ? box.label : undefined}>
            {boxContent(box)}
          </g>
        ),
      )}

      <text style={{ ...text, fill: p.muted, fontSize: FONT_SIZE - 1 }}>
        {layout.footer.lines.map((line, index) => (
          <tspan key={index} x={layout.footer.x} y={layout.footer.y + index * LINE_HEIGHT}>
            {line}
          </tspan>
        ))}
      </text>
    </svg>
  );
}
