import { useEffect } from 'react';
import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import { setUserId, setUserAttributes } from '@/lib/services/firebase';

/**
 * Hook to sync user authentication with Firebase Crashlytics
 * This helps identify which users are experiencing crashes
 */
export const useCrashlyticsUser = () => {
  const { session, user } = useSupabaseAuth();

  useEffect(() => {
    if (user) {
      // Set user ID for crash reports
      setUserId(user.id);

      // Set additional user attributes if needed
      const attributes: Record<string, string> = {};

      if (user.email) {
        attributes.email = user.email;
      }

      if (user.profile?.display_name) {
        attributes.name = user.profile.display_name;
      }

      if (user.subscription?.plan_tier) {
        attributes.planTier = user.subscription.plan_tier;
      }

      // Add any other relevant user metadata
      if (Object.keys(attributes).length > 0) {
        setUserAttributes(attributes);
      }
    }
  }, [user]);
};