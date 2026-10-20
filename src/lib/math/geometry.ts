import type { GeometryFigure } from "./generator.ts";

export type Solid = Exclude<GeometryFigure, { shape: "square" | "rectangle" | "triangle" }>;
type Vertex = [number, number, number];
type Dimension = { label: string; value: number; edge: [number, number] };

export function solidMesh(figure: Solid) {
  const vertices: Vertex[] = [];
  const faces: number[][] = [];
  const dimensions: Dimension[] = [];
  if (figure.shape === "cube" || figure.shape === "cuboid") {
    const [w, h, d] = figure.shape === "cube"
      ? [figure.side, figure.side, figure.side] : [figure.width, figure.height, figure.depth];
    for (const [x, y, z] of [[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1]])
      vertices.push([x*w/2, y*h/2, z*d/2]);
    faces.push([0,1,2,3],[4,7,6,5],[1,5,6,2],[4,0,3,7],[3,2,6,7],[4,5,1,0]);
    dimensions.push({ label: figure.shape === "cube" ? "Aresta" : "Comprimento", value: w, edge: [0,1] });
    if (figure.shape === "cuboid") dimensions.push({label:"Altura",value:h,edge:[1,2]}, {label:"Largura",value:d,edge:[1,5]});
  } else {
    const pyramid = figure.shape === "pyramid";
    const count = pyramid ? 3 : 24;
    const radius = pyramid ? figure.baseSide / Math.sqrt(3) : figure.radius;
    const topRadius = figure.shape === "cylinder" ? radius : figure.shape === "frustum" ? figure.topRadius : 0;
    for (let ring = 0; ring < 2; ring++) {
      for (let i = 0; i < count; i++) {
        const angle = 2*Math.PI*i/count;
        const r = ring ? topRadius : radius;
        vertices.push([r*Math.cos(angle), (ring ? 1 : -1)*figure.height/2, r*Math.sin(angle)]);
      }
    }
    faces.push(Array.from({length:count},(_,i)=>i).reverse(), Array.from({length:count},(_,i)=>i+count));
    for (let i=0;i<count;i++) faces.push([i,(i+1)%count,(i+1)%count+count,i+count]);
    const center = vertices.length;
    vertices.push([0,-figure.height/2,0],[0,figure.height/2,0]);
    dimensions.push(pyramid
      ? {label:"Lado da base", value:figure.baseSide, edge:[0,1]}
      : {label:"Raio da base", value:radius, edge:[center,0]});
    dimensions.push({label:"Altura",value:figure.height,edge:[center,center+1]});
    if (figure.shape === "frustum") dimensions.push({label:"Raio do topo",value:figure.topRadius,edge:[center+1,count]});
  }
  return {vertices, faces, dimensions};
}

export function projectSolid(figure: Solid, yaw: number, pitch: number) {
  const {vertices} = solidMesh(figure);
  const scale = 90 / Math.max(...vertices.map(([x,y,z])=>Math.hypot(x,y,z)));
  const y = yaw*Math.PI/180;
  const p = pitch*Math.PI/180;
  return vertices.map(([vx,vy,vz])=> {
    const x=vx*scale, vertical=vy*scale, z=vz*scale;
    const rx=x*Math.cos(y)+z*Math.sin(y);
    const rz=z*Math.cos(y)-x*Math.sin(y);
    return {x:180+rx, y:108-(vertical*Math.cos(p)-rz*Math.sin(p)), z:vertical*Math.sin(p)+rz*Math.cos(p)};
  });
}
