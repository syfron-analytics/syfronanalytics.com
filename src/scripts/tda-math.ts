// Persistent homology of a Vietoris–Rips filtration on a small 2-D point cloud, dimensions 0 and 1.
// Standard boundary-matrix reduction over Z/2; fine for a few dozen points.

export interface Pt {
  x: number;
  y: number;
}
export interface Edge {
  i: number;
  j: number;
  d: number;
}
export interface Triangle {
  a: number;
  b: number;
  c: number;
  d: number;
}
export interface Bar {
  birth: number;
  death: number; // Infinity when it survives the whole filtration
}

export function ripsPersistence(points: Pt[], maxEps: number) {
  const n = points.length;
  const dist = (i: number, j: number) => Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);

  const edges: Edge[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = dist(i, j);
      if (d <= maxEps) edges.push({ i, j, d });
    }
  }
  edges.sort((a, b) => a.d - b.d);
  const edgeIndex = new Map<number, number>();
  edges.forEach((e, k) => edgeIndex.set(e.i * n + e.j, k));

  // H0: Kruskal / union-find. An edge that merges two components kills the younger one (all born at 0).
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const h0: Bar[] = [];
  const negative = new Uint8Array(edges.length);
  edges.forEach((e, k) => {
    const a = find(e.i);
    const b = find(e.j);
    if (a === b) return;
    parent[a] = b;
    negative[k] = 1;
    h0.push({ birth: 0, death: e.d });
  });
  const survivors = new Set(Array.from({ length: n }, (_, i) => find(i))).size;
  for (let s = 0; s < survivors; s++) h0.push({ birth: 0, death: Infinity });

  // Triangles, ordered by diameter (ties by their youngest edge)
  const triangles: (Triangle & { boundary: number[] })[] = [];
  const idx = (i: number, j: number) => edgeIndex.get(i < j ? i * n + j : j * n + i);
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const ab = idx(a, b);
      if (ab === undefined) continue;
      for (let c = b + 1; c < n; c++) {
        const ac = idx(a, c);
        const bc = idx(b, c);
        if (ac === undefined || bc === undefined) continue;
        const boundary = [ab, ac, bc].sort((x, y) => x - y);
        triangles.push({ a, b, c, d: edges[boundary[2]].d, boundary });
      }
    }
  }
  triangles.sort((t, u) => t.d - u.d || t.boundary[2] - u.boundary[2]);

  // H1: reduce triangle boundaries; the lowest edge of each reduced column is the loop it fills.
  const owner = new Map<number, number[]>();
  const h1: Bar[] = [];
  for (const tri of triangles) {
    let col = tri.boundary.slice();
    while (col.length) {
      const low = col[col.length - 1];
      const other = owner.get(low);
      if (!other) break;
      col = symmetricDifference(col, other);
    }
    if (!col.length) continue;
    const low = col[col.length - 1];
    owner.set(low, col);
    if (!negative[low] && tri.d > edges[low].d) h1.push({ birth: edges[low].d, death: tri.d });
  }
  edges.forEach((e, k) => {
    if (!negative[k] && !owner.has(k)) h1.push({ birth: e.d, death: Infinity });
  });

  return { edges, triangles: triangles.map(({ a, b, c, d }) => ({ a, b, c, d })), h0, h1 };
}

function symmetricDifference(a: number[], b: number[]) {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (j >= b.length || (i < a.length && a[i] < b[j])) out.push(a[i++]);
    else if (i >= a.length || b[j] < a[i]) out.push(b[j++]);
    else {
      i++;
      j++;
    }
  }
  return out;
}
