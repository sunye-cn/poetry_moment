import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const users=sqliteTable('users',{id:text('id').primaryKey(),email:text('email').notNull().unique(),hash:text('password_hash').notNull(),salt:text('salt').notNull(),agreement:text('agreement_version').notNull(),created:integer('created_at').notNull()});
export const sessions=sqliteTable('sessions',{token:text('token_hash').primaryKey(),userId:text('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),expires:integer('expires_at').notNull()},t=>[index('sessions_expiry').on(t.expires)]);
export const attempts=sqliteTable('auth_attempts',{key:text('key').primaryKey(),count:integer('count').notNull(),reset:integer('reset_at').notNull()});
