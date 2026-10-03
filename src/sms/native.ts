import { PermissionsAndroid, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export interface RawSms {
  id: string;
  address: string;
  body: string;
  date: number; // epoch millis
}

interface AnchorSmsModule {
  hasPermission(): boolean;
  hasReceivePermission(): boolean;
  configureAlerts(enabled: boolean, senders: string[]): void;
  readInbox(sinceMillis: number, senderKeywords: string[], limit: number): Promise<RawSms[]>;
}

// Only present in Android builds that include modules/anchor-sms.
const native = Platform.OS === 'android' ? requireOptionalNativeModule<AnchorSmsModule>('AnchorSms') : null;

export const isSmsReadingAvailable = () => !!native;

export function hasSmsPermission(): boolean {
  try {
    return !!native?.hasPermission();
  } catch {
    return false;
  }
}

// READ_SMS is needed for the inbox scan; RECEIVE_SMS only for the instant
// alert, so declining that one still leaves the review inbox working.
export async function requestSmsPermission(): Promise<boolean> {
  if (!native) return false;
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.READ_SMS,
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
  ]);
  return result[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED;
}

export function hasReceivePermission(): boolean {
  try {
    return !!native?.hasReceivePermission();
  } catch {
    return false;
  }
}

// Hands the user's choices to the native SMS receiver, which runs without
// the app and can't read the JS settings store.
export function configureSmsAlerts(enabled: boolean, senders: string[]): void {
  try {
    native?.configureAlerts(enabled, senders);
  } catch (e) {
    console.warn('Could not configure SMS alerts', e);
  }
}

export async function readBankSms(sinceMillis: number, senders: string[], limit = 500): Promise<RawSms[]> {
  if (!native || !hasSmsPermission()) return [];
  return native.readInbox(sinceMillis, senders, limit);
}
