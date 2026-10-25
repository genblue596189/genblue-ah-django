-- Run AFTER creating Vault secrets below in Dashboard (never put tokens into Git):
-- gb_line_project_url = your Supabase Project URL (https://...supabase.co)
-- gb_line_dispatch_secret = same random value as Edge/Render LINE_DISPATCH_SECRET
-- Enable pg_cron and pg_net from Database > Extensions first.
-- This worker runs without any browser or Render instance being open.
SELECT cron.schedule('genblue-line-booking-notifications','* * * * *',$job$
 SELECT net.http_post(
  url:=(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='gb_line_project_url')||'/functions/v1/online-booking',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='gb_line_dispatch_secret')),
  body:='{}'::jsonb,
  timeout_milliseconds:=120000
 );
$job$);
