import * as React from 'react';
import {
  Pressable,
  ScrollView,
  Settings,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  SharedTransition,
  SharedTransitionBoundary,
} from 'react-native-reanimated';
import {
  createNavigationContainerRef,
  DarkTheme,
  NavigationContainer,
  useIsFocused,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// The app this was found in uses springify(400). After the shared elements
// land, the list row shows the wrong state until the spring finishes, so a
// longer spring (for example 1000) makes the problem easier to see.
const SPRING_DURATION = 400;
const transition = SharedTransition.springify(SPRING_DURATION).dampingRatio(1);
const entering = FadeIn.delay(350).duration(220).easing(Easing.out(Easing.cubic));

const CONTACTS = [
  { id: '1', name: 'Alice Test', email: 'user1@example.com' },
  { id: '2', name: 'Bob Test', email: 'user2@example.com' },
  { id: '3', name: 'Carol Test', email: 'user3@example.com' },
];

type Params = { Contacts: undefined; ContactDetails: { id: string } };
const Stack = createNativeStackNavigator<Params>();
const navigationRef = createNavigationContainerRef<Params>();
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const initials = (name: string) =>
  name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

// Each screen's content sits in a boundary that is active while the screen
// is focused, as the reanimated docs recommend.
function Boundary({ children }: { children: React.ReactNode }) {
  const isFocused = useIsFocused();
  return (
    <SharedTransitionBoundary isActive={isFocused}>
      {children}
    </SharedTransitionBoundary>
  );
}

function Avatar({
  id,
  name,
  size,
  withEntering,
}: {
  id: string;
  name: string;
  size: 'row' | 'detail';
  withEntering?: boolean;
}) {
  const box = size === 'row' ? 42 : 150;
  return (
    <Animated.View
      sharedTransitionTag={`photo-${id}`}
      sharedTransitionStyle={transition}
      entering={withEntering ? entering : undefined}
      collapsable={false}
      style={[
        styles.avatar,
        { width: box, height: box, borderRadius: box / 2 },
        size === 'row' && { marginRight: 10 },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size === 'row' ? 14 : 36 }]}>
        {initials(name)}
      </Text>
    </Animated.View>
  );
}

type Contact = (typeof CONTACTS)[number];

function Row({ contact, onPress }: { contact: Contact; onPress: () => void }) {
  return (
    <Pressable testID={`row-${contact.id}`} onPress={onPress} style={styles.row}>
      <Avatar id={contact.id} name={contact.name} size="row" />
      <View style={{ flex: 1 }}>
        <Animated.Text
          sharedTransitionTag={`name-${contact.id}`}
          sharedTransitionStyle={transition}
          style={styles.rowName}
        >
          {contact.name}
        </Animated.Text>
        <Text style={styles.rowEmail}>{contact.email}</Text>
      </View>
    </Pressable>
  );
}

function ContactsScreen({ navigation }: NativeStackScreenProps<Params, 'Contacts'>) {
  // Debug only: lets the auto-driver make one React commit on this screen
  // (see -commitAfterPop below).
  const [commits, setCommits] = React.useState(0);
  React.useEffect(() => {
    if (__DEV__) {
      (globalThis as any).__repro.commit = () => setCommits(c => c + 1);
    }
  }, []);
  return (
    <Boundary>
      <SafeAreaView style={styles.screen}>
        {__DEV__ && <Text style={styles.hidden}>{commits}</Text>}
        <Text style={styles.title}>CONTACTS ({CONTACTS.length})</Text>
        {CONTACTS.map(contact => (
          <Row
            key={contact.id}
            contact={contact}
            onPress={() => navigation.navigate('ContactDetails', { id: contact.id })}
          />
        ))}
      </SafeAreaView>
    </Boundary>
  );
}

function ContactDetailsScreen({
  navigation,
  route,
}: NativeStackScreenProps<Params, 'ContactDetails'>) {
  const contact = CONTACTS.find(c => c.id === route.params.id)!;
  return (
    <Boundary>
      <SafeAreaView style={styles.screen}>
        <Pressable
          testID="back"
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <Text style={styles.backText}>{'< Back'}</Text>
        </Pressable>
        <ScrollView contentContainerStyle={styles.detail}>
          <Avatar
            id={contact.id}
            name={contact.name}
            size="detail"
            withEntering
          />
          <Animated.Text
            sharedTransitionTag={`name-${contact.id}`}
            sharedTransitionStyle={transition}
            entering={entering}
            style={styles.detailName}
          >
            {contact.name}
          </Animated.Text>
          <Text style={styles.rowEmail}>{contact.email}</Text>
        </ScrollView>
      </SafeAreaView>
    </Boundary>
  );
}

// Optional driver for unattended runs (debug builds only). Launch with
// `xcrun simctl launch <udid> org.reactjs.native.example.SetRepro -autoDrive 1`
// to push a row, go back 1.5 s later, wait 6 s, and move to the next row.
// globalThis.__repro exposes push(i) and pop() for scripted runs over the
// debugger.
if (__DEV__) {
  (globalThis as any).__repro = {
    push: (index: number) =>
      navigationRef.navigate('ContactDetails', {
        id: CONTACTS[index % CONTACTS.length].id,
      }),
    pop: () => navigationRef.goBack(),
  };
}

// With `-commitAfterPop <ms>` as well, the driver makes one React commit on
// the list screen that many ms after each pop, which shows how long the row
// stays in the wrong state when nothing else commits.
async function autoDrive() {
  const commitAfterPop = Number(Settings.get('commitAfterPop')) || 0;
  for (let i = 0; ; i++) {
    await wait(2000);
    (globalThis as any).__repro.push(i);
    await wait(1500);
    (globalThis as any).__repro.pop();
    if (commitAfterPop) {
      await wait(commitAfterPop);
      (globalThis as any).__repro.commit?.();
      await wait(Math.max(0, 6000 - commitAfterPop));
    } else {
      await wait(6000);
    }
  }
}

export default function App() {
  const onReady = React.useCallback(() => {
    if (__DEV__ && Settings.get('autoDrive')) {
      autoDrive();
    }
  }, []);
  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} theme={DarkTheme} onReady={onReady}>
        <Stack.Navigator
          screenOptions={{ headerShown: false, animationDuration: 350 }}
        >
          <Stack.Screen name="Contacts" component={ContactsScreen} />
          <Stack.Screen name="ContactDetails" component={ContactDetailsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1f2328' },
  title: { color: '#a0a4ab', fontSize: 14, marginHorizontal: 28, marginVertical: 20 },
  row: {
    marginHorizontal: 28,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: '#31363f',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: { color: 'white', fontWeight: 'bold' },
  rowName: { fontSize: 16, color: 'white' },
  rowEmail: { fontSize: 14, color: '#a0a4ab' },
  hidden: { position: 'absolute', opacity: 0 },
  back: { padding: 16 },
  backText: { color: 'white', fontSize: 17 },
  detail: { alignItems: 'center', paddingTop: 20 },
  detailName: {
    fontSize: 40,
    fontWeight: 'bold',
    marginBottom: 10,
    color: 'white',
  },
});
