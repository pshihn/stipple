import Delaunator from 'delaunator';

export type Bounds = [number, number, number, number];

function collinear(d: Delaunator<ArrayLike<number>>) {
  const { triangles, coords } = d;
  for (let i = 0; i < triangles.length; i += 3) {
    const a = 2 * triangles[i],
      b = 2 * triangles[i + 1],
      c = 2 * triangles[i + 2],
      cross = (coords[c] - coords[a]) * (coords[b + 1] - coords[a + 1])
        - (coords[b] - coords[a]) * (coords[c + 1] - coords[a + 1]);
    if (cross > 1e-10) return false;
  }
  return true;
}

function jitter(x: number, y: number, r: number) {
  return [x + Math.sin(x + y) * r, y + Math.cos(x - y) * r];
}

export class Voronoi {
  private points: Float32Array;
  private delaunator: Delaunator<ArrayLike<number>>;
  private triangles?: Uint32Array | Int32Array;
  private collinear?: Int32Array;
  private halfedges?: Int32Array;
  private hull?: Uint32Array;
  private inedges: Int32Array;
  private hullIndex: Int32Array;

  constructor(points: Float32Array, [xmin, ymin, xmax, ymax]: Bounds) {
    if (!((xmax = +xmax) >= (xmin = +xmin)) || !((ymax = +ymax) >= (ymin = +ymin))) throw new Error('invalid bounds');
    this.points = points;
    this.delaunator = new Delaunator(points);
    this.inedges = new Int32Array(points.length / 2);
    this.hullIndex = new Int32Array(points.length / 2);
    this.init();
  }

  update() {
    (this.delaunator as any).update();
    this.init();
  }

  find(x: number, y: number, i = 0) {
    if ((x = +x, x !== x) || (y = +y, y !== y)) return -1;
    const i0 = i;
    let c;
    while ((c = this.step(i, x, y)) >= 0 && c !== i && c !== i0) i = c;
    return c;
  }

  private init() {
    const d = this.delaunator, points = this.points;

    // check for collinear
    if (d.hull && d.hull.length > 2 && collinear(d)) {
      this.collinear = Int32Array.from({ length: points.length / 2 }, (_, i) => i)
        .sort((i, j) => points[2 * i] - points[2 * j] || points[2 * i + 1] - points[2 * j + 1]); // for exact neighbors
      const e = this.collinear[0], f = this.collinear[this.collinear.length - 1],
        bounds = [points[2 * e], points[2 * e + 1], points[2 * f], points[2 * f + 1]],
        r = 1e-8 * Math.sqrt((bounds[3] - bounds[1]) ** 2 + (bounds[2] - bounds[0]) ** 2);
      for (let i = 0, n = points.length / 2; i < n; ++i) {
        const p = jitter(points[2 * i], points[2 * i + 1], r);
        points[2 * i] = p[0];
        points[2 * i + 1] = p[1];
      }
      this.delaunator = new Delaunator(points);
    } else {
      delete this.collinear;
    }

    const halfedges = this.halfedges = this.delaunator.halfedges;
    const hull = this.hull = this.delaunator.hull;
    const triangles = this.triangles = this.delaunator.triangles;
    const inedges = this.inedges.fill(-1);
    const hullIndex = this.hullIndex.fill(-1);

    // Compute an index from each point to an (arbitrary) incoming halfedge
    // Used to give the first neighbor of each point; for this reason,
    // on the hull we give priority to exterior halfedges
    for (let e = 0, n = halfedges.length; e < n; ++e) {
      const p = triangles[e % 3 === 2 ? e - 2 : e + 1];
      if (halfedges[e] === -1 || inedges[p] === -1) inedges[p] = e;
    }
    for (let i = 0, n = hull.length; i < n; ++i) {
      hullIndex[hull[i]] = i;
    }

    // degenerate case: 1 or 2 (distinct) points
    if (hull.length <= 2 && hull.length > 0) {
      this.triangles = new Int32Array(3).fill(-1);
      this.halfedges = new Int32Array(3).fill(-1);
      this.triangles[0] = hull[0];
      this.triangles[1] = hull[1];
      this.triangles[2] = hull[1];
      inedges[hull[0]] = 1;
      if (hull.length === 2) inedges[hull[1]] = 0;
    }
  }

  private step(i: number, x: number, y: number) {
    const { inedges, hullIndex, points } = this;
    const triangles = this.triangles!;
    const halfedges = this.halfedges!;
    const hull = this.hull!;
    if (inedges[i] === -1 || !points.length) return (i + 1) % (points.length >> 1);
    let c = i;
    let dc = (x - points[i * 2]) ** 2 + (y - points[i * 2 + 1]) ** 2;
    const e0 = inedges[i];
    let e = e0;
    do {
      const t = triangles[e];
      const dt = (x - points[t * 2]) ** 2 + (y - points[t * 2 + 1]) ** 2;
      if (dt < dc) dc = dt, c = t;
      e = e % 3 === 2 ? e - 2 : e + 1;
      if (triangles[e] !== i) break; // bad triangulation
      e = halfedges[e];
      if (e === -1) {
        e = hull[(hullIndex[i] + 1) % hull.length];
        if (e !== t) {
          if ((x - points[e * 2]) ** 2 + (y - points[e * 2 + 1]) ** 2 < dc) return e;
        }
        break;
      }
    } while (e !== e0);
    return c;
  }
}