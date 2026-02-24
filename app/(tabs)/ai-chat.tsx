
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function AIChatTabRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to standalone chat screen
    console.log('[AI Chat Tab] Redirecting to standalone chat screen...');
    router.replace('/ai-chat');
  }, [router]);

  return null;
}
