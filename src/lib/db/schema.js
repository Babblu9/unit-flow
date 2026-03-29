import { pgTable, text, timestamp, jsonb, integer, boolean, uuid, customType } from 'drizzle-orm/pg-core';

/* \u2500\u2500 custom type for BYTEA (Excel binary storage) \u2500\u2500 */
const bytea = customType({
  dataType() { return 'bytea'; },
  toDriver(value) { return value; },
  fromDriver(value) {
    if (Buffer.isBuffer(value)) return value;
    if (typeof value === 'string' && value.startsWith('\\x')) {
      return Buffer.from(value.slice(2), 'hex');
    }
    return Buffer.from(value);
  },
});

/* \u2500\u2500 Users table \u2500\u2500 */
export const users = pgTable('users', {
  id:        uuid('id').defaultRandom().primaryKey(),
  clerkId:   text('clerk_id').notNull().unique(),
  email:     text('email').notNull(),
  firstName: text('first_name'),
  lastName:  text('last_name'),
  avatarUrl: text('avatar_url'),
  plan:      text('plan').default('free'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/* \u2500\u2500 Unit Economics Conversations table \u2500\u2500
   Prefixed with ue_ to coexist with Fina AI's conversations table in the same DB. */
export const conversations = pgTable('ue_conversations', {
  id:             uuid('id').defaultRandom().primaryKey(),
  userId:         uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title:          text('title').default('New Model'),
  messages:       jsonb('messages').default([]),
  modelState:     jsonb('model_state'),
  agentMeta:      jsonb('agent_meta'),            // { businessType, knowledgeGraph, step, ... }
  stage:          text('stage').default('discovery'),
  completion:     integer('completion').default(0),
  validation:     jsonb('validation'),
  screenPhase:    text('screen_phase').default('welcome'),
  modelGenerated: boolean('model_generated').default(false),
  isActive:       boolean('is_active').default(true),
  createdAt:      timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/* \u2500\u2500 Unit Economics Generated Excels table \u2500\u2500
   Prefixed with ue_ to coexist with Fina AI's generated_excels table in the same DB. */
export const generatedExcels = pgTable('ue_generated_excels', {
  id:             uuid('id').defaultRandom().primaryKey(),
  userId:         uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  fileName:       text('file_name').notNull(),
  fileData:       bytea('file_data').notNull(),
  fileSize:       integer('file_size'),
  modelSnapshot:  jsonb('model_snapshot'),
  version:        integer('version').default(1),
  createdAt:      timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
