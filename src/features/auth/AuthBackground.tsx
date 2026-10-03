import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

// A deliberately different backdrop from the rest of the (light, utilitarian)
// app chrome: a near-black canvas with soft colored glows, blurred into a
// smooth wash. No gradient library needed — two large blurred circles behind
// a heavy BlurView fake a mesh-gradient look, evoking Apple ID / Apple Card
// sign-in screens rather than a plain system page.
export function AuthBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <View style={[styles.blob, styles.blobBlue]} />
      <View style={[styles.blob, styles.blobIndigo]} />
      <View style={[styles.blob, styles.blobPurple]} />
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobBlue: {
    width: 380,
    height: 380,
    backgroundColor: '#0A84FF',
    opacity: 0.35,
    top: -120,
    left: -100,
  },
  blobIndigo: {
    width: 420,
    height: 420,
    backgroundColor: '#5E5CE6',
    opacity: 0.3,
    bottom: -140,
    right: -120,
  },
  blobPurple: {
    width: 260,
    height: 260,
    backgroundColor: '#BF5AF2',
    opacity: 0.22,
    top: '38%',
    right: -80,
  },
});
