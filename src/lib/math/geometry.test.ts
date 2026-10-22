import assert from "node:assert/strict";
import test from "node:test";
import { projectSolid, solidMesh } from "./geometry.ts";
import type { Solid } from "./geometry.ts";

test("projeção preserva proporções e mantém o sólido visível ao girar", () => {
  const block: Solid = { shape: "cuboid", width: 12, height: 6, depth: 2 };
  const front = projectSolid(block, 0, 0);
  assert.equal((front[1].x - front[0].x) / (front[0].y - front[3].y), 2);
  for (const figure of [block, { shape: "cube", side: 8 } as const]) {
    for (let yaw = -360; yaw <= 360; yaw += 20) {
      for (let pitch = -70; pitch <= 70; pitch += 20) {
        const vertices = projectSolid(figure, yaw, pitch);
        assert.equal(vertices.length, 8);
        for (const vertex of vertices) {
          assert.ok(Number.isFinite(vertex.z));
          assert.ok(vertex.x >= 90 && vertex.x <= 270);
          assert.ok(vertex.y >= 18 && vertex.y <= 198);
        }
      }
    }
  }
  const rotated = projectSolid(block, 90, 0);
  assert.ok(Math.abs(rotated[0].x - rotated[1].x) < 1e-10);
  assert.ok(Math.abs(rotated[1].x - rotated[5].x) > 0);
});

test("malhas dos sólidos avançados preservam medidas e projeção sem pontos inválidos",()=>{
  const solids:Solid[]=[
    {shape:"prism",base:6,baseHeight:8,baseSide:10,height:12},
    {shape:"cylinder",radius:4,height:12},
    {shape:"cone",radius:6,height:9},
    {shape:"pyramid",baseSide:8,height:9},
    {shape:"frustum",radius:9,topRadius:4,height:15},
  ];
  for (const figure of solids) {
    const mesh=solidMesh(figure);
    for (const dimension of mesh.dimensions) {
      const [a,b]=dimension.edge.map((index)=>mesh.vertices[index]);
      const distance=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
      assert.ok(Math.abs(distance-dimension.value)<1e-9);
    }
    for (const face of mesh.faces) for (const index of face) assert.ok(mesh.vertices[index]);
    for (let yaw=-180;yaw<=180;yaw+=30) {
      const points=projectSolid(figure,yaw,65);
      for (const p of points) {
        assert.ok(Number.isFinite(p.z));
        assert.ok(p.x>=90-1e-9 && p.x<=270+1e-9);
        assert.ok(p.y>=18-1e-9 && p.y<=198+1e-9);
      }
    }
  }
});
