// import * as Notifications from 'expo-notifications';
// import { Platform } from 'react-native';

// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowAlert: true,
//     shouldPlaySound: true,
//     shouldSetBadge: true,
//   }),
// });

export const notificationService = {
  async requestPermissions(): Promise<boolean> {
    return true; // Mock
  },

  async scheduleDailyReminder(hour: number = 20, minute: number = 0): Promise<string | null> {
    console.log('Notification scheduled (mock)');
    return 'mock-id';
  },

  async cancelAllReminders(): Promise<void> {
     console.log('Notifications cancelled (mock)');
  },

  async getAllScheduledNotifications() {
    return [];
  },

  async sendImmediateNotification(title: string, body: string): Promise<void> {
    console.log('Notification sent:', title, body);
  },
};