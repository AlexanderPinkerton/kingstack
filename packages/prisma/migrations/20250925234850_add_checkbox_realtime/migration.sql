-- Enable realtime for the checkbox table (idempotent)
-- Check if the table is already in the publication before adding it
DO $$
BEGIN
    -- Only add the table if it's not already in the publication
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'checkbox'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE checkbox;
    END IF;
END $$;
