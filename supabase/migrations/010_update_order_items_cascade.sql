-- Ensure order_items rows are removed automatically when their item is deleted
alter table order_items
  drop constraint if exists order_items_item_id_fkey;

alter table order_items
  add constraint order_items_item_id_fkey
  foreign key (item_id)
  references items(id)
  on delete cascade;
