-- SaaS foundation. Run against PostgreSQL before migrating tenant data.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS tenants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text UNIQUE NOT NULL, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS tenant_members (tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE, user_id integer NOT NULL, role text NOT NULL CHECK (role IN ('owner','admin','cashier')), PRIMARY KEY (tenant_id,user_id));
CREATE TABLE IF NOT EXISTS plans (id text PRIMARY KEY, name text NOT NULL, monthly_satang bigint NOT NULL, branch_limit integer NOT NULL, user_limit integer NOT NULL);
CREATE TABLE IF NOT EXISTS subscriptions (tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE, plan_id text REFERENCES plans(id), provider text, provider_subscription_id text UNIQUE, status text NOT NULL, current_period_end timestamptz);
-- Every business table must carry tenant_id and enforce it through the request transaction.
CREATE INDEX IF NOT EXISTS tenant_members_user_idx ON tenant_members(user_id);
