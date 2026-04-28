-- 14-day card-free Team trial: backfill existing free orgs.
-- Trial rows are tagged stripeCustomerId='trial_<orgId>' and billingInterval='trial'
-- so they never collide with real Stripe rows or with manual_% rows from elevate-org.ts.
-- Idempotent via the NOT EXISTS guard.

insert into "subscription"
  (id, plan, "referenceId", "stripeCustomerId", status,
   "periodStart", "periodEnd", "trialStart", "trialEnd",
   seats, "billingInterval")
select
  'sub_' || substr(md5(random()::text || o.id), 1, 21),
  'team',
  o.id,
  'trial_' || o.id,
  'trialing',
  now(),
  now() + interval '14 days',
  now(),
  now() + interval '14 days',
  null,
  'trial'
from "organization" o
where not exists (
  select 1 from "subscription" s where s."referenceId" = o.id
);
