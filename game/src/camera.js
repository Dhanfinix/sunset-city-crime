// Smooth follow camera with velocity look-ahead and world-edge clamping.

export function createCamera(width, height) {
  const cam = {
    x: 0, y: 0, width, height, zoom: 1,
    resize(w, h) { this.width = w; this.height = h; },
    snap(x, y) { this.x = x; this.y = y; },
    follow(x, y, vx = 0, vy = 0, dt = 1 / 60) {
      const lead = 0.55;
      const tx = x + vx * lead;
      const ty = y + vy * lead;
      const k = 1 - Math.pow(0.0015, dt);
      this.x += (tx - this.x) * k;
      this.y += (ty - this.y) * k;
    },
  };
  return cam;
}
