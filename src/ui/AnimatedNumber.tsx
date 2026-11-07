import React, { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// Counts from the previous value to the new one, like Wallet and Health.
export function AnimatedNumber({
  value,
  format,
  style,
  duration = 500,
  numberOfLines,
}: {
  value: number;
  format: (n: number) => string;
  style?: StyleProp<TextStyle>;
  duration?: number;
  numberOfLines?: number;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const first = useRef(true);

  useEffect(() => {
    // Start from zero the first time so the figure "rolls up" on open.
    const start = first.current ? 0 : from.current;
    first.current = false;
    if (start === value) return;
    // Small changes (a coffee off a big balance) just update — counting
    // them up costs frames and reads as flicker.
    if (start !== 0 && Math.abs(value - start) < Math.abs(start) * 0.02) {
      from.current = value;
      setShown(value);
      return;
    }
    const began = Date.now();
    let frame = 0;
    let lastDraw = 0;
    const tick = () => {
      const now = Date.now();
      const t = Math.min(1, (now - began) / duration);
      // About 20 redraws a second is smooth for a counter and far cheaper
      // than every frame (each redraw re-measures auto-fitted text).
      if (t === 1 || now - lastDraw >= 50) {
        lastDraw = now;
        setShown(t === 1 ? value : Math.round(start + (value - start) * easeOut(t)));
      }
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = value;
    };
  }, [value]);

  return (
    <Text style={[{ fontVariant: ['tabular-nums'] }, style]} numberOfLines={numberOfLines} adjustsFontSizeToFit={!!numberOfLines}>
      {format(shown)}
    </Text>
  );
}
