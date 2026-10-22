"use client";

import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Box, RotateCcw } from "lucide-react";
import type { GeometryFigure } from "@/lib/math/generator";
import { isFlatFigure, projectSolid, solidMesh } from "@/lib/math/geometry";
import type { FlatFigure } from "@/lib/math/geometry";

const DEFAULT_VIEW = { yaw: -32, pitch: 24 };
const NAMES = { square: "Quadrado", triangle: "Triângulo", rectangle: "Retângulo", circle: "Círculo", trapezoid: "Trapézio isósceles", prism: "Prisma triangular", cube: "Cubo", cuboid: "Bloco retangular", cylinder: "Cilindro", cone: "Cone", pyramid: "Pirâmide triangular", frustum: "Tronco de cone" };
const COLORS = ["#5de3ff", "#ff8fc9", "#d5f85f", "#ffbf80"];
type Point = { x: number; y: number };

function flatDrawing(figure: FlatFigure) {
  const dimensions: {label: string; value: number; edge: [Point, Point]}[] = [];
  if (figure.shape === "circle") {
    dimensions.push({label:"Raio",value:figure.radius,edge:[{x:180,y:108},{x:245,y:108}]});
    return { points: "", dimensions };
  }
  const w = figure.shape === "square" ? figure.side : figure.base;
  const h = figure.shape === "square" ? figure.side : figure.height;
  const scale = Math.min(180 / w, 120 / h);
  const left = 180 - w * scale / 2, right = 180 + w * scale / 2;
  const top = 108 - h * scale / 2, bottom = 108 + h * scale / 2;
  const topWidth = figure.shape === "triangle" ? 0 : figure.shape === "trapezoid" ? figure.topBase * scale : w * scale;
  const topLeft = 180 - topWidth / 2, topRight = 180 + topWidth / 2;
  dimensions.push({label:figure.shape === "square" ? "Lado" : "Base",value:w,edge:[{x:left,y:bottom},{x:right,y:bottom}]});
  if (figure.shape !== "square") dimensions.push({label:"Altura",value:h,edge:[{x:figure.shape === "rectangle" ? right : 180,y:bottom},{x:figure.shape === "rectangle" ? right : 180,y:top}]});
  if (figure.shape === "triangle" && figure.side !== undefined) dimensions.push({label:"Cada lado",value:figure.side,edge:[{x:right,y:bottom},{x:180,y:top}]});
  if (figure.shape === "trapezoid") dimensions.push(
    {label:"Base menor",value:figure.topBase,edge:[{x:topLeft,y:top},{x:topRight,y:top}]},
    {label:"Cada lado",value:figure.side,edge:[{x:right,y:bottom},{x:topRight,y:top}]},
  );
  return { points:`${left},${bottom} ${right},${bottom} ${topRight},${top} ${topLeft},${top}`, dimensions };
}

export function GeometryViewer({ figure }: { figure: GeometryFigure }) {
  const [view, setView] = useState(DEFAULT_VIEW);
  const [selected, setSelected] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; x: number; y: number; yaw: number; pitch: number } | null>(null);
  const mesh = isFlatFigure(figure) ? null : solidMesh(figure);
  const flat = isFlatFigure(figure) ? flatDrawing(figure) : null;
  const solid = mesh !== null;
  const dimensions = mesh?.dimensions ?? flat!.dimensions;
  const description = `${NAMES[figure.shape]}: ${dimensions.map(({ label, value }) => `${label.toLowerCase()} ${value} cm`).join(", ")}.`;
  const vertices = isFlatFigure(figure) ? [] : projectSolid(figure, view.yaw, view.pitch);
  const faces = mesh ? mesh.faces.map((corners, index) => ({
    corners, color: COLORS[index % COLORS.length],
    depth: corners.reduce((sum, index) => sum + vertices[index].z, 0) / corners.length,
  })).sort((a, b) => a.depth - b.depth) : [];
  const edges = mesh
    ? mesh.dimensions.map(({edge}) => edge.map((index) => vertices[index]))
    : flat!.dimensions.map(({edge}) => edge);

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
        )) : figure.shape === "circle" ? (
          <circle cx="180" cy="108" r="65" fill="#5de3ff" fillOpacity="0.12" stroke="#5de3ff" strokeWidth="1.5" />
        ) : (
          <polygon points={flat!.points} fill="#5de3ff" fillOpacity="0.12" stroke="#5de3ff" strokeWidth="1.5" />
        )}
        {dimensions.map(({ value }, index) => {
          const [start, end] = edges[index];
          const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
          const position = solid
            ? [{x:180,y:205},{x:56,y:112},{x:304,y:112},{x:180,y:20}][index]
            : { x: midpoint.x, y: midpoint.y + 4 };
          if (!solid) {
            if (index === 0) position.y += 15;
            else if (index === 1) position.x += figure.shape === "rectangle" ? 27 : -25;
            else if (index === 2 && figure.shape === "trapezoid") position.y -= 16;
            else position.x += 28;
          }
          return (
            <g key={index} className={selected === index ? "dimension-selected" : ""}>
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={COLORS[index]} strokeWidth={selected === index ? 4 : 2} strokeDasharray={!solid && (figure.shape === "triangle" || figure.shape === "trapezoid") && index === 1 ? "4 3" : undefined} />
              {solid && <line x1={midpoint.x} y1={midpoint.y} x2={position.x} y2={position.y - 6} stroke={COLORS[index]} strokeWidth="1" strokeOpacity="0.4" />}
              <text x={position.x} y={position.y} fill={COLORS[index]} textAnchor="middle" className="geometry-measure">{value} cm</text>
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
