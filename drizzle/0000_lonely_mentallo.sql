CREATE TABLE "ue_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'New Model',
	"messages" jsonb DEFAULT '[]'::jsonb,
	"model_state" jsonb,
	"agent_meta" jsonb,
	"stage" text DEFAULT 'discovery',
	"completion" integer DEFAULT 0,
	"validation" jsonb,
	"screen_phase" text DEFAULT 'welcome',
	"model_generated" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ue_generated_excels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid,
	"file_name" text NOT NULL,
	"file_data" "bytea" NOT NULL,
	"file_size" integer,
	"model_snapshot" jsonb,
	"version" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"avatar_url" text,
	"plan" text DEFAULT 'free',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
ALTER TABLE "ue_conversations" ADD CONSTRAINT "ue_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ue_generated_excels" ADD CONSTRAINT "ue_generated_excels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ue_generated_excels" ADD CONSTRAINT "ue_generated_excels_conversation_id_ue_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ue_conversations"("id") ON DELETE set null ON UPDATE no action;