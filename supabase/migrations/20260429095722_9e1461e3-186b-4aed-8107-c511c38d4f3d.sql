-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'team_member');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'blocked');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.notification_type AS ENUM ('blocker', 'nudge', 'info', 'task_assigned', 'task_completed');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER_ROLES (separate table — security best practice) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role check (prevents RLS recursion + privilege escalation)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_user_id, 'admin'::public.app_role) $$;

-- ============ TEAMS ============
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Helper: is user a member of a team?
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id)
$$;

-- ============ TASKS ============
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'pending',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  deadline TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  completion_description TEXT,
  blocker_reason TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_creator ON public.tasks(creator_id);
CREATE INDEX idx_tasks_team ON public.tasks(team_id);
CREATE INDEX idx_tasks_scheduled ON public.tasks(scheduled_for);

-- Status validation (instead of CHECK with subqueries)
CREATE OR REPLACE FUNCTION public.tasks_validate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND (NEW.completion_description IS NULL OR length(NEW.completion_description) < 5) THEN
    RAISE EXCEPTION 'Completion description must be at least 5 characters';
  END IF;
  IF NEW.status = 'blocked' AND (NEW.blocker_reason IS NULL OR length(NEW.blocker_reason) < 3) THEN
    RAISE EXCEPTION 'Blocker reason is required';
  END IF;
  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER tasks_validate_trg BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_validate();

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_urgent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id, is_read);

-- ============ CHAT ============
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_chat_team ON public.chat_messages(team_id, created_at DESC);

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "auth users read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "admins update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admins delete profile" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- user_roles
CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- teams
CREATE POLICY "members read teams" ON public.teams FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_team_member(auth.uid(), id) OR owner_id = auth.uid());
CREATE POLICY "admins manage teams" ON public.teams FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- team_members
CREATE POLICY "members read team_members" ON public.team_members FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_team_member(auth.uid(), team_id) OR user_id = auth.uid());
CREATE POLICY "admins manage team_members" ON public.team_members FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- tasks
CREATE POLICY "view own/assigned/admin tasks" ON public.tasks FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR creator_id = auth.uid() OR assignee_id = auth.uid()
         OR (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id)));
CREATE POLICY "users insert own tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());
CREATE POLICY "update own/assigned tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR creator_id = auth.uid() OR assignee_id = auth.uid());
CREATE POLICY "delete own tasks or admin" ON public.tasks FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR creator_id = auth.uid());

-- notifications
CREATE POLICY "recipient reads own" ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "recipient updates own" ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid());
CREATE POLICY "system or admin inserts" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "recipient or admin deletes" ON public.notifications FOR DELETE TO authenticated
  USING (recipient_id = auth.uid() OR public.is_admin(auth.uid()));

-- chat
CREATE POLICY "team members read chat" ON public.chat_messages FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_team_member(auth.uid(), team_id));
CREATE POLICY "team members post chat" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND (public.is_admin(auth.uid()) OR public.is_team_member(auth.uid(), team_id)));
CREATE POLICY "sender or admin deletes chat" ON public.chat_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.is_admin(auth.uid()));

-- ============ TRIGGERS: auto profile + role on signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  is_seed_admin BOOLEAN := lower(NEW.email) = 'vidhantomar2004@gmail.com';
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_seed_admin THEN 'admin'::public.app_role ELSE 'team_member'::public.app_role END)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ BLOCKER NOTIFICATION TRIGGER ============
CREATE OR REPLACE FUNCTION public.notify_on_blocker()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE admin_id UUID;
BEGIN
  IF NEW.status = 'blocked' AND (OLD.status IS DISTINCT FROM 'blocked') THEN
    -- notify creator
    IF NEW.creator_id <> auth.uid() THEN
      INSERT INTO public.notifications(recipient_id, type, title, body, task_id, is_urgent)
      VALUES (NEW.creator_id, 'blocker', 'Task blocked: ' || NEW.title, NEW.blocker_reason, NEW.id, true);
    END IF;
    -- notify all admins
    FOR admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      INSERT INTO public.notifications(recipient_id, type, title, body, task_id, is_urgent)
      VALUES (admin_id, 'blocker', 'Task blocked: ' || NEW.title, NEW.blocker_reason, NEW.id, true);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_task_blocked AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_on_blocker();

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;