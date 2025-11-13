import { useEffect } from 'react';
import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import { setUserId, setUserAttributes } from '@/lib/services/firebase';

/**
 * Hook to sync user authentication with Firebase Crashlytics
 * This helps identify which users are experiencing crashes
 */
export const useCrashlyticsUser = () => {
  const { user } = useSupabaseAuth();

  useEffect(() => {
    if (user) {
      // Set user ID for crash reports
      setUserId(user.id);

      // Set additional user attributes if needed
      const attributes: Record<string, string> = {};

      if (user.email) {
        attributes.email = user.email;
      }

      if (user.profile?.fullName) {
        attributes.name = user.profile.fullName;
      }

      if (user.subscription?.plan?.tier) {
        attributes.planTier = user.subscription.plan.tier;
      }

      // Add any other relevant user metadata
      if (Object.keys(attributes).length > 0) {
        setUserAttributes(attributes);
      }
    }
  }, [user]);
};