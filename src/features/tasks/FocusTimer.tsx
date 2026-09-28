import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../ui/Button';
import { ChipSelector } from '../../ui/ChipSelector';
import { useProductivityStore } from '../../store/productivityStore';
import { cancelFocusEnd, scheduleFocusEnd } from '../../notifications/scheduler';
import type { Task } from '../../db/types';

const DURATIONS = [15, 25, 50];

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Tracks an end timestamp rather than counting ticks, so the countdown stays
// right even if Android pauses JS timers while the app is in the background.
export function FocusTimer({ task, visible, onClose }: { task: Task | null; visible: boolean; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const logFocusSession = useProductivityStore((s) => s.logFocusSession);
  const [minutes, setMinutes] = useState(25);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [pausedRemaining, setPausedRemaining] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [finished, setFinished] = useState(false);

  const running = endsAt !== null;
  const remaining = running ? endsAt - now : pausedRemaining ?? minutes * 60000;

  useEffect(() => {
    if (!running) return;
    const handle = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(handle);
  }, [running]);

  useEffect(() => {
    if (running && remaining <= 0) {
      setEndsAt(null);
      setPausedRemaining(null);
      setFinished(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      logFocusSession(task?.id ?? null, minutes);
    }
  }, [running, remaining]);

  const start = () => {
    const end = Date.now() + (pausedRemaining ?? minutes * 60000);
    setFinished(false);
    setNow(Date.now());
    setEndsAt(end);
    setPausedRemaining(null);
    scheduleFocusEnd(end, task?.title ?? 'Nice work');
  };

  const pause = () => {
    if (endsAt === null) return;
    setPausedRemaining(endsAt - Date.now());
    setEndsAt(null);
    cancelFocusEnd();
  };

  const reset = () => {
    setEndsAt(null);
    setPausedRemaining(null);
    setFinished(false);
    cancelFocusEnd();
  };

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground, padding: spacing.xl, justifyContent: 'center' }}>
        <Pressable onPress={close} hitSlop={12} style={{ position: 'absolute', top: spacing.xxxl, right: spacing.xl }}>
          <Text style={[typography.body, { color: colors.blue }]}>Done</Text>
        </Pressable>
        <Text style={[typography.subhead, { color: colors.secondaryLabel, textAlign: 'center' }]}>Focusing on</Text>
        <Text style={[typography.title2, { color: colors.label, textAlign: 'center', marginTop: 4 }]} numberOfLines={2}>
          {task?.title ?? 'Focus'}
        </Text>
        <Text
          style={{
            fontSize: 72,
            fontWeight: '200',
            color: finished ? colors.green : colors.label,
            textAlign: 'center',
            marginVertical: spacing.xxl,
            fontVariant: ['tabular-nums'],
          }}
        >
          {finished ? 'Done!' : formatClock(remaining)}
        </Text>
        {!running && pausedRemaining === null ? (
          <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
            <ChipSelector
              options={DURATIONS.map((d) => ({ id: String(d), label: `${d} min` }))}
              selectedId={String(minutes)}
              onSelect={(id) => {
                setMinutes(Number(id));
                setFinished(false);
              }}
            />
          </View>
        ) : null}
        {running ? (
          <Button title="Pause" variant="secondary" onPress={pause} />
        ) : (
          <Button title={pausedRemaining !== null ? 'Resume' : finished ? 'Start another' : 'Start'} onPress={start} />
        )}
        {running || pausedRemaining !== null ? (
          <Button title="Reset" variant="plain" onPress={reset} style={{ marginTop: spacing.sm }} />
        ) : null}
      </View>
    </Modal>
  );
}
