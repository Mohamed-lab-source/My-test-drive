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

export async function requestSmsPermission(): Promise<boolean> {
  if (!native) return false;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
    title: 'Read bank SMS',
    message: 'Anchor reads debit alerts from the senders you choose (e.g. HSBC) to suggest expenses. Other messages are never read or stored.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function readBankSms(sinceMillis: number, senders: string[], limit = 500): Promise<RawSms[]> {
  if (!native || !hasSmsPermission()) return [];
  return native.readInbox(sinceMillis, senders, limit);
}
