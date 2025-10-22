-- Allow deleting a user by cascading or nulling profile references

alter table organizations
  drop constraint if exists organizations_created_by_fkey;

alter table organizations
  add constraint organizations_created_by_fkey
  foreign key (created_by)
  references profiles(id)
  on delete set null;

alter table organization_members
  drop constraint if exists organization_members_invited_by_fkey;

alter table organization_members
  add constraint organization_members_invited_by_fkey
  foreign key (invited_by)
  references profiles(id)
  on delete set null;

alter table items
  drop constraint if exists items_created_by_fkey;

alter table items
  add constraint items_created_by_fkey
  foreign key (created_by)
  references profiles(id)
  on delete set null;

alter table orders
  drop constraint if exists orders_created_by_fkey;

alter table orders
  add constraint orders_created_by_fkey
  foreign key (created_by)
  references profiles(id)
  on delete set null;
