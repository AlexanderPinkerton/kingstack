-- Enable realtime for the post table (idempotent)
-- Check if the table is already in the publication before adding it
DO $$
BEGIN
    -- Only add the table if it's not already in the publication
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'post'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE post;
    END IF;
END $$;
