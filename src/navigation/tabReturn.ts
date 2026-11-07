// Back goes to the screen you came from. A screen opened from another tab
// (a card tapped on Home, a widget, a search result) is pushed into its own
// tab's stack, so plain back would land on that tab's main screen (Money)
// instead of the screen you were on (Home). These listeners send back
// (button, Android back or swipe) to the tab you came from instead, and
// put the tab you left back on its main screen, so Money opens on Money
// again rather than on the card you already closed. A tab you only switched
// away from keeps whatever you had open.
import { CommonActions, StackActions, type EventArg, type NavigationAction } from 'expo-router/react-navigation';

interface StackNav {
  getState: () => { routes: { key: string; name: string }[] } | undefined;
  getParent: () => { goBack: () => void } | undefined;
  dispatch: (a: NavigationAction) => void;
}

// Each tab's stack, as last seen by one of its screens.
const stacks = new Map<string, StackNav>();
// The last switch between tabs.
let lastSwitch: { from: string; to: string; at: number } | null = null;
// Screens opened from another tab, by route key.
const openedFrom = new Map<string, string>();
const seen = new Set<string>();

// For each tab's Stack.
export function tabStackListeners(tab: string) {
  return ({ navigation, route }: { navigation: unknown; route: { key: string } }) => {
    const nav = navigation as StackNav;
    return {
      focus: () => {
        stacks.set(tab, nav);
        if (seen.has(route.key)) return;
        seen.add(route.key);
        // Opened as the app switched to this tab: it came from that tab.
        // (Checked a moment later, once the switch has been recorded.)
        setTimeout(() => {
          const isRoot = nav.getState()?.routes[0]?.key === route.key;
          if (!isRoot && lastSwitch && lastSwitch.to === tab && Date.now() - lastSwitch.at < 1500) openedFrom.set(route.key, lastSwitch.from);
        }, 0);
      },
      beforeRemove: (e: EventArg<'beforeRemove', true, { action: NavigationAction }>) => {
        const from = openedFrom.get(route.key);
        openedFrom.delete(route.key);
        const type = e.data.action.type;
        if (!from || (type !== 'GO_BACK' && type !== 'POP')) {
          seen.delete(route.key);
          return;
        }
        // Back to the tab it came from; the reset below then closes it.
        e.preventDefault();
        nav.getParent()?.goBack();
      },
    };
  };
}

interface TabsState {
  index: number;
  routes: { key: string; name: string }[];
  history?: { type: string; key: string }[];
}

let focusedTab: string | null = null;
let lastState: TabsState | undefined;

// For the Tabs: notes tab switches, and resets a tab you've gone back out of.
export function tabReturnListeners() {
  return {
    state: (e: { data?: { state?: unknown } }) => {
      const st = e.data?.state as TabsState | undefined;
      // Every tab hears the same event; act on it once.
      if (!st?.routes || st === lastState) return;
      lastState = st;
      const focused = st.routes[st.index];
      if (focused && focused.name !== focusedTab) {
        if (focusedTab) lastSwitch = { from: focusedTab, to: focused.name, at: Date.now() };
        focusedTab = focused.name;
      }
      if (!st.history) return;
      const kept = new Set(st.history.filter((h) => h.type === 'route').map((h) => h.key));
      for (const r of st.routes) {
        if (r.key === focused?.key || kept.has(r.key)) continue;
        const nav = stacks.get(r.name);
        const routes = nav?.getState()?.routes;
        if (!nav || !routes?.length || (routes.length === 1 && routes[0].name === 'index')) continue;
        // Back to the main screen: closing what's on top keeps it as it was.
        nav.dispatch(routes[0].name === 'index' ? StackActions.popToTop() : CommonActions.reset({ index: 0, routes: [{ name: 'index' }] }));
      }
    },
  };
}
