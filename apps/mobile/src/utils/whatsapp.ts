import { Linking, Share } from "react-native";

/** Opens WhatsApp with the message pre-filled, falling back to the system share sheet. */
export async function shareViaWhatsApp(message: string): Promise<void> {
  try {
    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
  } catch {
    Share.share({ message }).catch(() => {});
  }
}
