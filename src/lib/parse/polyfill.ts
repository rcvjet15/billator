/**
 * Minimal pure-JS DOM polyfills needed by pdfjs-dist (via pdf-parse) for text
 * extraction in a standalone Node/Next server runtime. pdf.js text extraction
 * references DOMMatrix (and, for some PDFs, Path2D/ImageData) which don't exist
 * in plain Node. These are installed once at server start (instrumentation).
 */
export function installDomPollyfills(): void {
  const g = globalThis as Record<string, unknown>;
  if (!("DOMMatrix" in g)) {
    // Minimal but functional 2D DOMMatrix used by pdf.js text layout.
    class DOMMatrix {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;

      constructor(
        init?:
          | string
          | [
              ...number[],
            ],
      ) {
        if (typeof init === "string") {
          const vals = init
            // eslint-disable-next-line no-control-regex
            .replace(/[^\d.,+\-\s]/g, "")
            .split(/[\s,]+/)
            .map(Number);
          if (vals.length >= 6) {
            this.a = vals[0]!;
            this.b = vals[1]!;
            this.c = vals[2]!;
            this.d = vals[3]!;
            this.e = vals[4]!;
            this.f = vals[5]!;
          }
        } else if (Array.isArray(init) && init.length >= 6) {
          this.a = init[0]!;
          this.b = init[1]!;
          this.c = init[2]!;
          this.d = init[3]!;
          this.e = init[4]!;
          this.f = init[5]!;
        }
      }

      multiply(other: DOMMatrix) {
        return new DOMMatrix([
          this.a * other.a + this.c * other.b,
          this.b * other.a + this.d * other.b,
          this.a * other.c + this.c * other.d,
          this.b * other.c + this.d * other.d,
          this.a * other.e + this.c * other.f + this.e,
          this.b * other.e + this.d * other.f + this.f,
        ] as unknown as [number, number, number, number, number, number]);
      }

      translate(tx: number, ty: number) {
        return new DOMMatrix([
          this.a,
          this.b,
          this.c,
          this.d,
          this.a * tx + this.c * ty + this.e,
          this.b * tx + this.d * ty + this.f,
        ] as unknown as [number, number, number, number, number, number]);
      }

      scale(sx: number, sy?: number) {
        const syv = sy ?? sx;
        return new DOMMatrix([
          this.a * sx,
          this.b * sx,
          this.c * syv,
          this.d * syv,
          this.e,
          this.f,
        ] as unknown as [number, number, number, number, number, number]);
      }

      transformPoint(p: { x: number; y: number }) {
        return {
          x: this.a * p.x + this.c * p.y + this.e,
          y: this.b * p.x + this.d * p.y + this.f,
        };
      }

      toString() {
        return `matrix(${this.a},${this.b},${this.c},${this.d},${this.e},${this.f})`;
      }
    }
    g.DOMMatrix = DOMMatrix;
  }

  if (!("Path2D" in g)) {
    // pdf.js only measures path bounds for some ops; a no-op is enough for text.
    class Path2D {
      addPath(): void | null {
        return null;
      }
      closePath(): void | null {
        return null;
      }
      moveTo(): void | null {
        return null;
      }
      lineTo(): void | null {
        return null;
      }
      bezierCurveTo(): void | null {
        return null;
      }
      quadraticCurveTo(): void | null {
        return null;
      }
      arc(): void | null {
        return null;
      }
      rect(): void | null {
        return null;
      }
    }
    g.Path2D = Path2D;
  }

  if (!("ImageData" in g)) {
    class ImageData {
      width: number;
      height: number;
      data: Uint8ClampedArray;
      constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
        this.data = new Uint8ClampedArray(w * h * 4);
      }
    }
    g.ImageData = ImageData;
  }
}
