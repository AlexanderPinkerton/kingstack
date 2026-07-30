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
