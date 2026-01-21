import { Stack } from "expo-router";
import { ThemeProvider } from "../utils/ThemeContext";
import { ToastProvider } from "../components/Toast";
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </ToastProvider>
    </ThemeProvider>
  );
}
