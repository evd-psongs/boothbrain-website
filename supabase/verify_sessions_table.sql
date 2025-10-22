-- Check if the sessions table exists and show its structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM
    information_schema.columns
WHERE
    table_schema = 'public'
    AND table_name = 'sessions'
ORDER BY
    ordinal_position;

-- Check indexes on the sessions table
SELECT
    indexname,
    indexdef
FROM
    pg_indexes
WHERE
    schemaname = 'public'
    AND tablename = 'sessions';

-- Check if there are any existing sessions (just for info)
SELECT COUNT(*) as session_count FROM public.sessions;