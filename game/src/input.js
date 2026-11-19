// Keyboard and mouse state. One pressed-set is consumed per frame for edge-triggered actions.

const ACTIONS = { CONFIRM: 1, PAUSE: 2, ENTER: 4, RELOAD: 8, MAP: 16, NIGHT: 32, MUTE: 64 };
export { ACTIONS };

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let actions = 0;

  const actionKeys = {
    Space: ACTIONS.CONFIRM,
    Enter: ACTIONS.CONFIRM,
    Escape: ACTIONS.PAUSE,
    KeyP: ACTIONS.PAUSE,
    KeyE: ACTIONS.ENTER,
    KeyR: ACTIONS.RELOAD,
    KeyM: ACTIONS.MAP,
    KeyN: ACTIONS.NIGHT,
    KeyV: ACTIONS.MUTE,
  };

  function onKey(e, down) {
    if (actionKeys[e.code] && down && !keys.has(e.code)) actions |= actionKeys[e.code];
    if (down) keys.add(e.code);
    else keys.delete(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  }
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => keys.clear());

  function position(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
    mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
  }
  window.addEventListener('mousemove', position);
  canvas.addEventListener('mousedown', (e) => {
    position(e);
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys, mouse,
    isDown: (code) => keys.has(code),
    move() {
      let x = 0, y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      const m = Math.hypot(x, y) || 1;
      return { x: x / m, y: y / m };
    },
    sprint: () => keys.has('ShiftLeft') || keys.has('ShiftRight'),
    takeActions() { const a = actions; actions = 0; return a; },
    takeClicked() { const c = mouse.clicked; mouse.clicked = false; return c; },
  };
}
