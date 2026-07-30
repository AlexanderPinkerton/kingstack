-- Keep the Prisma model and the auth-user projection aligned.
UPDATE public.user
SET previous_usernames = ARRAY[]::TEXT[]
WHERE previous_usernames IS NULL;

ALTER TABLE public.user
    ALTER COLUMN previous_usernames SET DEFAULT ARRAY[]::TEXT[],
    ALTER COLUMN previous_usernames SET NOT NULL;

-- Repair users that exist in Supabase Auth but not in the application table.
-- Preserve usernames already changed through the application on ID conflicts.
INSERT INTO public.user (id, email, username, previous_usernames)
SELECT
    auth_user.id::TEXT,
    auth_user.email,
    CASE
        WHEN NULLIF(auth_user.raw_user_meta_data ->> 'username', '') IS NOT NULL
            AND CHAR_LENGTH(auth_user.raw_user_meta_data ->> 'username') BETWEEN 3 AND 40
            AND (auth_user.raw_user_meta_data ->> 'username')
                ~ '^[A-Za-z0-9][A-Za-z0-9_-]*[A-Za-z0-9]$'
        THEN auth_user.raw_user_meta_data ->> 'username'
        ELSE 'user_' || REPLACE(auth_user.id::TEXT, '-', '')
    END,
    ARRAY[]::TEXT[]
FROM auth.users AS auth_user
WHERE auth_user.email IS NOT NULL
ON CONFLICT (id) DO UPDATE
SET
    email = EXCLUDED.email,
    previous_usernames = COALESCE(
        public.user.previous_usernames,
        ARRAY[]::TEXT[]
    );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    requested_username TEXT := NULLIF(
        NEW.raw_user_meta_data ->> 'username',
        ''
    );
    resolved_username TEXT;
BEGIN
    -- The application user model requires email, while Supabase Auth can also
    -- contain phone-only identities. Leave those identities in auth.users
    -- without aborting their creation.
    IF NEW.email IS NULL THEN
        RETURN NEW;
    END IF;

    IF requested_username IS NOT NULL
        AND CHAR_LENGTH(requested_username) BETWEEN 3 AND 40
        AND requested_username ~ '^[A-Za-z0-9][A-Za-z0-9_-]*[A-Za-z0-9]$'
    THEN
        resolved_username := requested_username;
    ELSE
        resolved_username := 'user_' || REPLACE(NEW.id::TEXT, '-', '');
    END IF;

    INSERT INTO public.user (id, email, username, previous_usernames)
    VALUES (
        NEW.id::TEXT,
        NEW.email,
        resolved_username,
        ARRAY[]::TEXT[]
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        previous_usernames = COALESCE(
            public.user.previous_usernames,
            ARRAY[]::TEXT[]
        );

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
