// Keyboard and mouse for the Kutilang-9. Arrows (or WASD) fly the plane,
// W/S (or Shift/Ctrl) work the throttle, B brakes on the strip, and the
// mouse starts the sortie and clicks the title away. Every key is read
// from a held set, so the plane answers at every speed.
export function makeInput() {
  const keys = new Set();
  const input = {
    pitch: 0, roll: 0, throttle: 0, brake: false,
    started: false, pausePressed: false, restartPressed: false, mutePressed: false,
    attach() {
      window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
        if (e.repeat) return;
        keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
        if (e.key === 'Enter' || e.key === ' ') input.started = true;
        if (e.key === 'p' || e.key === 'P') input.pausePressed = true;
        if (e.key === 'r' || e.key === 'R') input.restartPressed = true;
        if (e.key === 'm' || e.key === 'M') input.mutePressed = true;
      });
      window.addEventListener('keyup', (e) => {
        keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      });
      window.addEventListener('mousedown', () => { input.started = true; });
      window.addEventListener('blur', () => keys.clear());
    },
    poll() {
      const down = (...names) => names.some((n) => keys.has(n));
      input.pitch = (down('ArrowUp', 'w') ? 1 : 0) + (down('ArrowDown', 's') ? -1 : 0);
      // Arrows or WASD fly the plane; Shift/Ctrl alone work the throttle,
      // so pitch and power never fight over the same key.
      input.roll = (down('ArrowLeft', 'a') ? -1 : 0) + (down('ArrowRight', 'd') ? 1 : 0);
      input.throttle = (down('Shift') ? 1 : 0) + (down('Control') ? -1 : 0);
      input.brake = down('b');
    },
    consumeFlags() {
      const flags = {
        started: input.started,
        pause: input.pausePressed,
        restart: input.restartPressed,
        mute: input.mutePressed,
      };
      input.started = false; input.pausePressed = false;
      input.restartPressed = false; input.mutePressed = false;
      return flags;
    },
  };
  return input;
}
