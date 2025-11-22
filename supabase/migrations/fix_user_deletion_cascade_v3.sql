-- =====================================================
-- FIX: Enable CASCADE DELETE for all user-related tables
-- SAFE VERSION - Only updates constraints that exist
-- =====================================================

-- ============================================
-- 1. PROFILES TABLE
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'id'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 2. ITEMS TABLE
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'items'
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_user_id_fkey;
    ALTER TABLE public.items ADD CONSTRAINT items_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 3. ORDERS TABLE
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'orders'
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
    ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 4. EVENTS TABLE
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'events'
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_user_id_fkey;
    ALTER TABLE public.events ADD CONSTRAINT events_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 5. SESSIONS TABLE (uses host_user_id)
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'sessions'
    AND column_name = 'host_user_id'
  ) THEN
    ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_host_user_id_fkey;
    ALTER TABLE public.sessions ADD CONSTRAINT sessions_host_user_id_fkey
      FOREIGN KEY (host_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 6. SESSION_MEMBERS TABLE
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'session_members'
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.session_members DROP CONSTRAINT IF EXISTS session_members_user_id_fkey;
    ALTER TABLE public.session_members ADD CONSTRAINT session_members_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'session_members'
    AND column_name = 'session_id'
  ) THEN
    ALTER TABLE public.session_members DROP CONSTRAINT IF EXISTS session_members_session_id_fkey;
    ALTER TABLE public.session_members ADD CONSTRAINT session_members_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 7. USER_SETTINGS TABLE
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_settings'
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;
    ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 8. PAYMENT_LINKS TABLE
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'payment_links'
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.payment_links DROP CONSTRAINT IF EXISTS payment_links_user_id_fkey;
    ALTER TABLE public.payment_links ADD CONSTRAINT payment_links_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 9. SUBSCRIPTIONS TABLE
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'subscriptions'
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 10. ORDER_ITEMS TABLE (cascade from orders)
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'order_items'
    AND column_name = 'order_id'
  ) THEN
    ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
    ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 11. EVENT_STAGED_ITEMS TABLE
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'event_staged_items'
    AND column_name = 'event_id'
  ) THEN
    ALTER TABLE public.event_staged_items DROP CONSTRAINT IF EXISTS event_staged_items_event_id_fkey;
    ALTER TABLE public.event_staged_items ADD CONSTRAINT event_staged_items_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'event_staged_items'
    AND column_name = 'item_id'
  ) THEN
    ALTER TABLE public.event_staged_items DROP CONSTRAINT IF EXISTS event_staged_items_item_id_fkey;
    ALTER TABLE public.event_staged_items ADD CONSTRAINT event_staged_items_item_id_fkey
      FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 12. ITEM_IMAGES TABLE
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'item_images'
    AND column_name = 'item_id'
  ) THEN
    ALTER TABLE public.item_images DROP CONSTRAINT IF EXISTS item_images_item_id_fkey;
    ALTER TABLE public.item_images ADD CONSTRAINT item_images_item_id_fkey
      FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'CASCADE DELETE constraints successfully updated!';
  RAISE NOTICE 'You can now delete users from the Supabase Dashboard without errors.';
END $$;
