-- AVORA CRM — 0012 new membership role for lead portal logins.
-- (Kept in its own migration: a new enum value can't be used in the same transaction.)
alter type public.app_role add value if not exists 'lead';
