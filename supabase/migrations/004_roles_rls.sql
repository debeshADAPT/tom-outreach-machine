-- ─── 1. Profiles table ────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read their own profile row (role assignment done manually)
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- ─── 2. Trigger: auto-create a 'staff' profile on every new signup ────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, role) VALUES (NEW.id, 'staff');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 3. Seed profiles for users who existed before this migration ─────────────
INSERT INTO public.profiles (id, role)
SELECT id, 'staff' FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ─── 4. Drop old ownership-based RLS on campaigns ─────────────────────────────
-- (If these names differ in your project, drop them manually via the Supabase dashboard)
DROP POLICY IF EXISTS "Users can view their own campaigns"    ON public.campaigns;
DROP POLICY IF EXISTS "Users can insert their own campaigns"  ON public.campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns"  ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete their own campaigns"  ON public.campaigns;
DROP POLICY IF EXISTS "Enable read access for all users"          ON public.campaigns;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.campaigns;
DROP POLICY IF EXISTS "Enable update for users based on user_id"  ON public.campaigns;
DROP POLICY IF EXISTS "Enable delete for users based on user_id"  ON public.campaigns;

-- ─── 5. New campaigns RLS ─────────────────────────────────────────────────────
CREATE POLICY "All authenticated users can view campaigns"
  ON public.campaigns FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert campaigns"
  ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only admins can update campaigns"
  ON public.campaigns FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only admins can delete campaigns"
  ON public.campaigns FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── 6. Drop old ownership-based RLS on prospects ────────────────────────────
DROP POLICY IF EXISTS "Users can view prospects for their campaigns"    ON public.prospects;
DROP POLICY IF EXISTS "Users can insert prospects for their campaigns"  ON public.prospects;
DROP POLICY IF EXISTS "Users can update prospects for their campaigns"  ON public.prospects;
DROP POLICY IF EXISTS "Users can delete prospects for their campaigns"  ON public.prospects;
DROP POLICY IF EXISTS "Enable read access for all users"          ON public.prospects;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.prospects;
DROP POLICY IF EXISTS "Enable update for users based on user_id"  ON public.prospects;
DROP POLICY IF EXISTS "Enable delete for users based on user_id"  ON public.prospects;

-- ─── 7. New prospects RLS ────────────────────────────────────────────────────
CREATE POLICY "All authenticated users can view prospects"
  ON public.prospects FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert prospects"
  ON public.prospects FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only admins can update prospects"
  ON public.prospects FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only admins can delete prospects"
  ON public.prospects FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── After running this migration, promote your account ───────────────────────
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'debesh.ghimire@adapt.com.au');
