-- Better Auth: add @better-auth/stripe plugin tables.
-- Generated 2026-04-16. Incremental diff over the previous migration.

alter table "user" add column if not exists "stripeCustomerId" text;

alter table "organization" add column if not exists "stripeCustomerId" text;

create table if not exists "subscription" (
  "id" text not null primary key,
  "plan" text not null,
  "referenceId" text not null,
  "stripeCustomerId" text,
  "stripeSubscriptionId" text,
  "status" text not null,
  "periodStart" timestamptz,
  "periodEnd" timestamptz,
  "trialStart" timestamptz,
  "trialEnd" timestamptz,
  "cancelAtPeriodEnd" boolean,
  "cancelAt" timestamptz,
  "canceledAt" timestamptz,
  "endedAt" timestamptz,
  "seats" integer,
  "billingInterval" text,
  "stripeScheduleId" text
);

create index if not exists "subscription_referenceId_idx" on "subscription" ("referenceId");
create index if not exists "subscription_stripeCustomerId_idx" on "subscription" ("stripeCustomerId");
