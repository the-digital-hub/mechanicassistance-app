import { useUser } from '@/context/UserContext';
import { Redirect, Stack } from 'expo-router';

export default function AssistLayout() {
  const { user } = useUser();

  // The request feed and its detail are mechanic screens. Hiding the tab is not
  // enough: a customer can still land here through navigation, so send them home.
  if (user && user.role !== 'mechanic') return <Redirect href="/(tabs)/dashboard" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
