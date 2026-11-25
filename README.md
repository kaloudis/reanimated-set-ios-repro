# Reanimated shared element return transition: list row not restored until the next commit (iOS)

A minimal React Native app with two screens: a list of three contacts and a
detail screen. Each row's avatar (`Animated.View` with the initials as a child
`Text`) and name (`Animated.Text`) are shared elements with the matching
elements on the detail screen.

## What happens

On iOS, after you go back from the detail screen, the shared elements land in
the list row, but the row is not restored to its own state. It stays wrong
until the next React commit on the surface. If nothing commits, that can be
many seconds.

- react-native-reanimated 4.8.0: the row's name shows the detail screen's
  style (40 pt bold, clipped to the row's text height) and the avatar shows no
  initials.
- react-native-reanimated 4.7.1: the name has the row's style, but the avatar
  shows no initials.

So 4.7.1 already leaves the avatar's child hidden until the next commit, and
4.8.0 also leaves the name in the detail screen's style.

## Measured (iPhone 17 Pro simulator, iOS 26.5, Debug, `springify(400)`)

Runs use the built-in auto-driver (`-autoDrive 1`, no debugger attached): push
a row, `navigation.goBack()` 1.5 s later, wait 6 s, next row. The recording is
read at 20 frames per second. A frame counts as wrong when the list is in
place and the popped row's white text or initials differ from the untouched
list.

| | pops | name in the detail style | initials missing |
|---|---|---|---|
| 4.8.0 | 19 | 19, of which 9 for 6.8 to 7.75 s | in the same frames |
| 4.7.1 | 13 | 0 | 13, of which 9 for 7.65 to 7.75 s |

The long cases end when the auto-driver pushes the next row, which is the next
React commit. With `-commitAfterPop 3000` the driver makes one React commit on
the list screen (a hidden `Text` changes) 3 s after each pop. On 4.8.0 the
wrong state then ended at that commit in 5 of 5 pops (2.70 s after landing,
about 3 s after the pop).

With a debugger attached over Metro's inspector, the wrong state ended within
about 1 s in every pop, on both versions. Connecting a debugger seems to cause
an early commit, so check this without one.

`evidence/` has 1 frame per second strips (read left to right, top to
bottom) of one pop on each version without a debugger:

- `reanimated-4.8.0-autodrive-1fps.png`: Alice's row shows the large name and
  an empty avatar in frames 1 to 8, until the next push (frame 9).
- `reanimated-4.7.1-autodrive-1fps.png`: frame 1 is the end of the
  transition, and Alice's avatar is empty in frames 2 to 9, until the next
  push (frame 10).

`*-pop.png` are 8 frames per second strips of a debugger-driven pop.

## Versions

- react-native 0.88.1, react 19.3.0, Hermes, New Architecture
- react-native-reanimated 4.8.0, react-native-worklets 0.14.0
- `"reanimated": { "staticFeatureFlags": { "ENABLE_SHARED_ELEMENT_TRANSITIONS": true } }` in package.json
- @react-navigation/native 7.5.2, @react-navigation/native-stack 7.21.1
- react-native-screens 4.30.1, react-native-safe-area-context 5.11.1
- Xcode 27.2, simulator runtime iOS 26.5

## Run it

```
yarn install
cd ios && pod install && cd ..
yarn start
yarn ios
```

## Steps

1. Tap a contact row.
2. Tap "< Back" (it calls `navigation.goBack()`).
3. Do not touch the screen. Look at the row you came from.

Expected: the row shows its own name style and the avatar initials once the
transition ends.
Actual on 4.8.0: the row shows the detail screen's large bold name, clipped,
and an empty avatar until something commits (for example the next tap).
Actual on 4.7.1: the avatar is empty until something commits.

Unattended, in a debug build:

```
xcrun simctl launch <udid> org.reactjs.native.example.SetRepro -autoDrive 1
xcrun simctl launch <udid> org.reactjs.native.example.SetRepro -autoDrive 1 -commitAfterPop 3000
```

`globalThis.__repro.push(i)`, `pop()` and `commit()` are also exposed in debug
builds.

`SPRING_DURATION` in `App.tsx` sets the shared transition's spring (400
matches the app this was found in).

## Switch to 4.7.1

```
yarn add react-native-reanimated@4.7.1 react-native-worklets@0.13.1 --exact
cd ios && pod install && cd ..
yarn start --reset-cache
yarn ios
```

## Not covered

- Android was not run with this app. In the app this was found in, Android
  shows the correct row state after every pop.
- Pops with the native back swipe were not tested, only `navigation.goBack()`.
- Release builds were not tested.
