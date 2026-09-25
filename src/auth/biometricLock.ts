import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const STORAGE_KEY = 'anchor-biometric-lock';

export async function isBiometricAvailable(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

export async function isBiometricLockEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(STORAGE_KEY)) === '1';
}

export async function setBiometricLockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
}

export async function authenticate(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Anchor' });
  return result.success;
}
