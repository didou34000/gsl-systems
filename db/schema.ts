import {sqliteTable,text,index,primaryKey} from 'drizzle-orm/sqlite-core';
export const sourcingDrafts=sqliteTable('sourcing_drafts',{id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),kind:text('kind').notNull(),title:text('title').notNull(),payload:text('payload').notNull(),createdAt:text('created_at').notNull()},t=>[index('idx_drafts_owner_created').on(t.ownerId,t.createdAt)]);
export const selections=sqliteTable('selections',{ownerId:text('owner_id').notNull(),productId:text('product_id').notNull()},t=>[primaryKey({columns:[t.ownerId,t.productId]})]);
