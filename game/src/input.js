// Keyboard + mouse input. Call consume() once per frame for edge-triggered actions.

export const ACTION_INTERACT = 'interact';
export const ACTION_RELOAD = 'reload';
export const ACTION_PAUSE = 'pause';
export const ACTION_CONFIRM = 'confirm';
export const ACTION_WEAPON = 'weapon';
export const ACTION_RAIN = 'rain';
export const ACTION_SAVE = 'save';
export const ACTION_CONTINUE = 'continue';

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, pressed: false };
  const map = {
    KeyE: ACTION_INTERACT, KeyR: ACTION_RELOAD, KeyP: ACTION_PAUSE,
    Escape: ACTION_PAUSE, Enter: ACTION_CONFIRM, Space: ACTION_CONFIRM,
    KeyQ: ACTION_WEAPON, KeyT: ACTION_RAIN, F6: ACTION_SAVE, KeyC: ACTION_CONTINUE,
  };

  function onKey(e, isDown) {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(code)) e.preventDefault();
    if (isDown) {
      if (!down.has(code)) pressed.add(code);
      down.add(code);
    } else {
      down.delete(code);
    }
  }
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width * canvas.width;
    mouse.y = (e.clientY - r.top) / r.height * canvas.height;
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true; mouse.pressed = true; } });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    isDown(code) { return down.has(code); },
    axis() {
      let x = 0, y = 0;
      if (down.has('KeyA') || down.has('ArrowLeft')) x -= 1;
      if (down.has('KeyD') || down.has('ArrowRight')) x += 1;
      if (down.has('KeyW') || down.has('ArrowUp')) y -= 1;
      if (down.has('KeyS') || down.has('ArrowDown')) y += 1;
      return { x, y };
    },
    // Steering for vehicles: A/D or arrows, W throttle, S brake/reverse.
    drive() {
      let steer = 0, throttle = 0;
      if (down.has('KeyA') || down.has('ArrowLeft')) steer -= 1;
      if (down.has('KeyD') || down.has('ArrowRight')) steer += 1;
      if (down.has('KeyW') || down.has('ArrowUp')) throttle += 1;
      if (down.has('KeyS') || down.has('ArrowDown')) throttle -= 1;
      return { steer, throttle };
    },
    mouse,
    consume() {
      const actions = new Set();
      for (const code of pressed) if (map[code]) actions.add(map[code]);
      pressed.clear();
      const click = mouse.pressed;
      mouse.pressed = false;
      return { actions, click };
    },
    clear() { down.clear(); pressed.clear(); mouse.down = false; mouse.pressed = false; },
  };
}
