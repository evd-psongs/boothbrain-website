-- Track subscription pause state and usage
alter table subscriptions
  add column if not exists paused_at timestamptz,
  add column if not exists pause_used_period_start timestamptz;

comment on column subscriptions.paused_at is 'Timestamp when the subscription was last paused';
comment on column subscriptions.pause_used_period_start is 'Billing period start for which the pause allowance has been used';
