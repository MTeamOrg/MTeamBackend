-- M-Team exposes data through its Express API, not through Supabase Data API.
-- Keep Prisma access through the table owner while denying direct public API access.

DO $$
DECLARE
  table_name text;
  api_role text;
  application_tables text[] := ARRAY[
    '_prisma_migrations',
    'user',
    'member_profile',
    'trainer_profile',
    'membership_price',
    'payment',
    'medical_certificate',
    'branch',
    'access_point',
    'access_log',
    'weekly_schedule',
    'scheduled_class',
    'trainer_branch',
    'user_audit_log',
    'event',
    'news_post',
    'notification'
  ];
BEGIN
  FOREACH table_name IN ARRAY application_tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      table_name
    );
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC',
      table_name
    );

    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format(
          'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I',
          table_name,
          api_role
        );
      END IF;
    END LOOP;
  END LOOP;

  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC',
    current_user
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC',
    current_user
  );

  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM %I',
        current_user,
        api_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM %I',
        current_user,
        api_role
      );
    END IF;
  END LOOP;
END
$$;
