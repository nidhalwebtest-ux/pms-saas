// Empty boundary so opening the New Property modal doesn't bubble up to the
// parent properties/loading.tsx skeleton (which would briefly replace the list
// underneath the intercepted modal). The global NavigationProgress top bar in
// the dashboard layout is the loading indicator for this navigation.
export default function NewPropertyLoading() {
  return null;
}
