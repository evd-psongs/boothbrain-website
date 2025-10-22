-- Remove event limits from all subscription tiers (events are free features)

UPDATE subscription_plans
SET max_events = NULL
WHERE max_events IS NOT NULL;

