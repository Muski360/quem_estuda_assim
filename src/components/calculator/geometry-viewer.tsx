"use client";

import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Box, RotateCcw } from "lucide-react";
import type { GeometryFigure } from "@/lib/math/generator";
import { projectSolid, solidMesh } from "@/lib/math/geometry";

const DEFAULT_VIEW = { yaw: -32, pitch: 24 };
const NAMES = { square: "Quadrado", triangle: "Triângulo", rectangle: "Retângulo", cube: "Cubo", cuboid: "Bloco retangular", cylinder: "Cilindro", cone: "Cone", pyramid: "Pirâmide triangular", frustum: "Tronco de cone" };
const COLORS = ["#5de3ff", "#ff8fc9", "#d5f85f"];

export function GeometryViewer({ figure }: { figure: GeometryFigure }) {
  const [view, setView] = useState(DEFAULT_VIEW);
  const [selected, setSelected] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; x: number; y: number; yaw: number; pitch: number } | null>(null);
  const mesh = figure.shape === "square" || figure.shape === "triangle" || figure.shape === "rectangle" ? null : solidMesh(figure);
  const solid = mesh !== null;
  const dimensions = mesh?.dimensions ?? (figure.shape === "square"
    ? [{ label: "Lado", value: figure.side }]
    : "base" in figure ? [{ label: "Base", value: figure.base }, { label: "Altura", value: figure.height }] : []);
  const description = `${NAMES[figure.shape]}: ${dimensions.map(({ label, value }) => `${label.toLowerCase()} ${value} cm`).join(", ")}.`;
  const vertices = figure.shape === "square" || figure.shape === "triangle" || figure.shape === "rectangle" ? [] : projectSolid(figure, view.yaw, view.pitch);
  const faces = mesh ? mesh.faces.map((corners, index) => ({
    corners, color: COLORS[index % COLORS.length],
    depth: corners.reduce((sum, index) => sum + vertices[index].z, 0) / corners.length,
  })).sort((a, b) => a.depth - b.depth) : [];
  const flatWidth = figure.shape === "square" ? figure.side : "base" in figure ? figure.base : 1;
  const flatHeight = figure.shape === "square" ? figure.side : "height" in figure ? figure.height : 1;
  const flatScale = Math.min(190 / flatWidth, 130 / flatHeight);
  const width = flatWidth * flatScale;
  const height = flatHeight * flatScale;
  const left = 180 - width / 2;
  const bottom = 106 + height / 2;
  const top = bottom - height;
  const apex = left + width / 2;
  const edges = mesh
    ? mesh.dimensions.map(({edge}) => edge.map((index) => vertices[index]))
    : [
        [{ x: left, y: bottom }, { x: left + width, y: bottom }],
        [{ x: figure.shape === "triangle" ? apex : left + width, y: bottom }, { x: figure.shape === "triangle" ? apex : left + width, y: top }],
      ];

  function rotate(yaw: number, pitch: number) {
    setView((previous) => ({
      yaw: (previous.yaw + yaw) % 360,
      pitch: Math.max(-70, Math.min(70, previous.pitch + pitch)),
    }));
  }

  function endDrag(event: PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <figure className={`geometry-viewer${solid ? " is-solid" : ""}${dragging ? " is-dragging" : ""}`} aria-label={description}>
      <figcaption>
        <span><Box size={13} aria-hidden="true" />{NAMES[figure.shape]}</span>
        <span>{solid ? "ARRASTE PARA GIRAR" : "TOQUE NAS MEDIDAS"}</span>
      </figcaption>
      <svg
        className="geometry-canvas"
        viewBox="0 0 360 216"
        role="img"
        aria-label={description}
        onPointerDown={(event) => {
          if (!solid || event.button !== 0 || !event.isPrimary) return;
          drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, ...view };
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          setView({
            yaw: (drag.current.yaw + (event.clientX - drag.current.x) * 0.6) % 360,
            pitch: Math.max(-70, Math.min(70, drag.current.pitch + (event.clientY - drag.current.y) * 0.5)),
          });
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      >
        <ellipse cx="180" cy="199" rx="91" ry="5" fill="#090d1e" opacity="0.5" />
        {solid ? faces.map(({ corners, color }, index) => (
          <polygon
            key={index}
            className="solid-face"
            points={corners.map((corner) => `${vertices[corner].x},${vertices[corner].y}`).join(" ")}
            fill={color}
            fillOpacity="0.12"
            stroke={color}
            strokeOpacity="0.55"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        )) : figure.shape === "triangle" ? (
          <>
            <polygon points={`${left},${bottom} ${left + width},${bottom} ${apex},${top}`} fill="#5de3ff" fillOpacity="0.12" stroke="#5de3ff" strokeWidth="1.5" />
            <path d={`M${apex - 8},${bottom}v-8h8`} fill="none" stroke="#ff8fc9" strokeWidth="1.2" />
          </>
        ) : (
          <rect x={left} y={top} width={width} height={height} fill="#5de3ff" fillOpacity="0.12" stroke="#5de3ff" strokeWidth="1.5" />
        )}
        {dimensions.map(({ value }, index) => {
          const [start, end] = edges[index];
          return (
            <g key={index} className={selected === index ? "dimension-selected" : ""}>
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={COLORS[index]} strokeWidth={selected === index ? 4 : 2} strokeDasharray={!solid && figure.shape === "triangle" && index === 1 ? "4 3" : undefined} />
              <text x={(start.x + end.x) / 2 + (index === 1 ? 24 : 0)} y={(start.y + end.y) / 2 + (index === 0 ? 19 : index === 2 ? -10 : 0)} fill={COLORS[index]} textAnchor="middle" className="geometry-measure">{value} cm</text>
            </g>
          );
        })}
      </svg>
      <div className="geometry-dimensions" role="group" aria-label="Destacar medidas da figura">
        {dimensions.map(({ label, value }, index) => (
          <button key={label} type="button" aria-pressed={selected === index} onClick={() => setSelected(selected === index ? null : index)} style={{ color: COLORS[index] }}>
            {label} <strong>{value} cm</strong>
          </button>
        ))}
      </div>
      {solid && (
        <div className="geometry-controls" role="group" aria-label="Girar sólido">
          <button type="button" onClick={() => rotate(-20, 0)} aria-label="Girar sólido para a esquerda"><ArrowLeft size={15} /></button>
          <button type="button" onClick={() => rotate(20, 0)} aria-label="Girar sólido para a direita"><ArrowRight size={15} /></button>
          <button type="button" onClick={() => rotate(0, -15)} aria-label="Inclinar sólido para cima"><ArrowUp size={15} /></button>
          <button type="button" onClick={() => rotate(0, 15)} aria-label="Inclinar sólido para baixo"><ArrowDown size={15} /></button>
          <button type="button" onClick={() => { setView(DEFAULT_VIEW); setSelected(null); }} aria-label="Restaurar vista do sólido"><RotateCcw size={15} /></button>
        </div>
      )}
    </figure>
  );
}
