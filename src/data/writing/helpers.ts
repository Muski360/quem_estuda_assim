import type { Competency, WritingActivity } from "../../lib/writing/types.ts";

// These assemble fixed editorial records; they do not generate study content.
export const choice = (c: Competency, n: number, skill: string, prompt: string, options: string[], evidence: string[], explanation: string): WritingActivity => ({ id: `es-${c.toLowerCase()}-${String(n).padStart(2, "0")}`, competency: c, skill, kind: "choice", prompt, options, evidence, explanation });
export const order = (c: Competency, n: number, skill: string, prompt: string, blocks: string[], explanation: string): WritingActivity => ({ id: `es-${c.toLowerCase()}-${String(n).padStart(2, "0")}`, competency: c, skill, kind: "order", prompt, options: blocks, evidence: [], explanation });
