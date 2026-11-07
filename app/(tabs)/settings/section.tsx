import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SettingsScreen, SECTION_TITLES, type SettingsSection } from '../../../src/features/settings/SettingsScreen';

// One Settings section (General, Money, Prayer & Hijri…) on its own page.
export default function SettingsSectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const section = (id && id in SECTION_TITLES ? id : 'general') as SettingsSection;
  return <SettingsScreen section={section} />;
}
