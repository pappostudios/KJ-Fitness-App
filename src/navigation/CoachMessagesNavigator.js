import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ConversationsScreen from '../screens/coach/ConversationsScreen';
import CoachChatScreen from '../screens/coach/CoachChatScreen';

const Stack = createStackNavigator();

// Nested stack for the coach messages tab:
//   Conversations (list) → CoachChat (individual conversation)
export default function CoachMessagesNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Conversations" component={ConversationsScreen} />
      <Stack.Screen name="CoachChat" component={CoachChatScreen} />
    </Stack.Navigator>
  );
}
