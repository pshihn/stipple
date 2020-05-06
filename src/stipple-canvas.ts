import { createProgram, resizeCanvasToDisplaySize } from './gl-utils';
import { loadImageData } from './image-utils';
import { BitmapData, stipple, StippleInfo } from './stipple';

const vs = `
attribute vec2 a_src;
attribute vec2 a_dst;

uniform vec2 u_resolution;
uniform mat3 u_matrix;
uniform float u_time;

void main() {
  // vec2 position = (u_matrix * vec3(a_src, 1)).xy;
  vec2 position = a_src + ((a_dst - a_src) * u_time);
  vec2 zeroToOne = position / u_resolution;
  vec2 zeroToTwo = zeroToOne * 2.0;
  vec2 clipSpace = zeroToTwo - 1.0;
  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  gl_PointSize = 6.0;
}
`;

const fs = `
precision mediump float;

void main() {
  vec2 cxy = 2.0 * gl_PointCoord - 1.0;
  float r = dot(cxy, cxy);
  float alpha = 1.0 - smoothstep(0.1, 1.0, r);
  if (r > 1.0) {
    discard;
  }
  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0) * alpha;
}
`;

const ANIMATION_DURATION = 5000;

export class StippleCanvas {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private srcLoc = 0;
  private dstLoc = 0;
  private resolutionLoc: WebGLUniformLocation | null;
  private matrixLoc: WebGLUniformLocation | null;
  private timeLoc: WebGLUniformLocation | null;
  private srcBuffer: WebGLBuffer;
  private dstBuffer: WebGLBuffer;
  private n = 10000;
  private srcPoints?: Float32Array;
  private dstPoints?: Float32Array;

  private animationTimeStart = 0;
  private animating = false;

  private imageMap = new Map<string, StippleInfo>();
  private currentImage = '';
  private scale = 1;
  private offset = [0, 0];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl');
    if (gl === null) {
      throw new Error('Unable to initialize WebGL. Your browser or machine may not support it.');
    }
    this.gl = gl;
    this.program = createProgram(gl, vs, fs);

    // locations
    this.dstLoc = gl.getAttribLocation(this.program, 'a_dst');
    this.srcLoc = gl.getAttribLocation(this.program, 'a_src');
    this.resolutionLoc = gl.getUniformLocation(this.program, 'u_resolution');
    this.matrixLoc = gl.getUniformLocation(this.program, 'u_matrix');
    this.timeLoc = gl.getUniformLocation(this.program, 'u_time');

    // create buffers
    this.srcBuffer = gl.createBuffer()!;
    this.dstBuffer = gl.createBuffer()!;
  }

  private updatePoints(points: Float32Array, dst: boolean) {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, dst ? this.dstBuffer : this.srcBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, points, this.gl.STATIC_DRAW);
    if (dst) {
      this.dstPoints = points;
    } else {
      this.srcPoints = points;
    }
  }

  async start() {
    // TOOD do this in worker
    const n = this.n;
    const { width, height } = this.canvas;
    const srcPoints = new Float32Array(n * 2);
    const points = new Float32Array(n * 2);
    for (let i = 0; i < this.n; i++) {
      points[i * 2] = Math.floor(Math.random() * width);
      points[i * 2 + 1] = Math.floor(Math.random() * height);
      srcPoints[i * 2] = srcPoints[i * 2 + 1] = 0;
    }
    this.updatePoints(srcPoints, false);
    this.updatePoints(points, true);

    this.animationTimeStart = 0;
    this.nextTic();
  }

  private nextTic() {
    requestAnimationFrame((time: number) => this.tic(time));
  }

  private tic(time: number) {
    const t1 = performance.now();

    let t = 1;
    if (this.animating) {
      if (!this.animationTimeStart) {
        this.animationTimeStart = time;
      }
      t = Math.min(1, (time - this.animationTimeStart) / ANIMATION_DURATION);
    }

    const gl = this.gl;
    resizeCanvasToDisplaySize(this.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.program);

    // bind src
    gl.bindBuffer(gl.ARRAY_BUFFER, this.srcBuffer);
    gl.enableVertexAttribArray(this.srcLoc);
    gl.vertexAttribPointer(this.srcLoc, 2, gl.FLOAT, false, 0, 0);

    // bind dst
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dstBuffer);
    gl.enableVertexAttribArray(this.dstLoc);
    gl.vertexAttribPointer(this.dstLoc, 2, gl.FLOAT, false, 0, 0);

    // set uniforms
    gl.uniform2f(this.resolutionLoc, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(this.timeLoc, t);

    // Draw!
    gl.drawArrays(gl.POINTS, 0, this.n);

    const delta = performance.now() - t1;
    if (delta > 1) {
      console.log(delta);
    }

    if (t < 1) {
      this.nextTic();
    } else if (this.animating) {
      this.animating = false;
    }
  }

  private update(points: Float32Array) {
    if (this.dstPoints) {
      this.updatePoints(this.dstPoints, false);
    }
    this.updatePoints(points, true);
    this.animationTimeStart = 0;
    if (!this.animating) {
      this.animating = true;
      this.nextTic();
    }
  }

  async drawImage(url: string) {
    if (this.currentImage !== url) {
      this.currentImage = url;
      let info: StippleInfo | null = null;
      if (this.imageMap.has(url)) {
        info = this.imageMap.get(url)!;
      } else {
        const imageData = await loadImageData(url);
        if (this.currentImage !== url) {
          return;
        }
        if (imageData.width && imageData.height) {
          const data: BitmapData = {
            buffer: imageData.data,
            height: imageData.height,
            width: imageData.width,
            pointCount: this.n
          };
          info = await stipple(data, 60);
          if (this.currentImage !== url) {
            return;
          }
          this.imageMap.set(url, info);
        }
      }
      if (info) {
        this.scale = Math.min(this.canvas.width / info.width, this.canvas.height / info.height);
        this.update(info.points);
      }
    }
  }
}