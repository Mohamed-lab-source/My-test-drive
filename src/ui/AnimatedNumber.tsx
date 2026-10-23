import React, { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// Counts from the previous value to the new one, like Wallet and Health.
export function AnimatedNumber({
  value,
  format,
  style,
  duration = 750,
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
    const began = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - began) / duration);
      const next = start + (value - start) * easeOut(t);
      setShown(t === 1 ? value : Math.round(next));
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
