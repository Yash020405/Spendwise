import { store } from "../store/store";
import { Stack } from "expo-router";
import { Provider } from 'react-redux';
import { ThemeProvider } from "../utils/ThemeContext";
import { ToastProvider } from "../components/Toast";
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <ToastProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
        </ToastProvider>
      </ThemeProvider>
    </Provider>
  );
}
