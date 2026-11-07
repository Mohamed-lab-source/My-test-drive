import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQuickAddStore } from '../store/quickAddStore';

interface FABProps {
  onPress: () => void;
  icon?: string;
}

let nextId = 1;

// A screen's main "add" action. Instead of drawing its own floating button,
// it hands the action to the + button beside the tab bar while the screen
// is in focus, so adding always happens from the same place.
export function FAB({ onPress, icon = 'plus' }: FABProps) {
  const latest = useRef(onPress);
  useEffect(() => {
    latest.current = onPress;
  }, [onPress]);
  const id = useRef(nextId++).current;

  useFocusEffect(
    useCallback(() => {
      const { setScreenAction } = useQuickAddStore.getState();
      setScreenAction({ id, icon, onPress: () => latest.current() });
      return () => {
        // Only clear it if another screen hasn't already taken over.
        if (useQuickAddStore.getState().screenAction?.id === id) setScreenAction(null);
      };
    }, [id, icon])
  );

  return null;
}
