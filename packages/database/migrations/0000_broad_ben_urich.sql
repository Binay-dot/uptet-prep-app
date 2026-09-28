CREATE TYPE "public"."friend_request_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."paper_id" AS ENUM('paper_1', 'paper_2');--> statement-breakpoint
CREATE TYPE "public"."question_source" AS ENUM('pyq', 'ai_drafted');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('pyq_verified', 'calibration', 'live', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."quiz_scope" AS ENUM('section_practice', 'full_mock');--> statement-breakpoint
CREATE TYPE "public"."section_id" AS ENUM('child_development_pedagogy', 'language_1_hindi', 'language_2_english', 'mathematics', 'evs', 'social_studies');--> statement-breakpoint
CREATE TYPE "public"."user_lifecycle_status" AS ENUM('active', 'pending_deletion', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'content_reviewer', 'admin');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text DEFAULT 'auth0' NOT NULL,
	"provider_subject" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text,
	"preparing_for" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"lifecycle_status" "user_lifecycle_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" "paper_id" NOT NULL,
	"section_id" "section_id" NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_option_index" integer NOT NULL,
	"source" "question_source" NOT NULL,
	"status" "question_status" DEFAULT 'calibration' NOT NULL,
	"source_year" integer,
	"source_note" text,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"difficulty" real,
	"discrimination" real,
	"response_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quiz_attempt_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"selected_option_index" integer,
	"is_correct" boolean,
	"answered_at" timestamp with time zone,
	"difficulty_at_attempt" real
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"paper_id" "paper_id" NOT NULL,
	"scope" "quiz_scope" NOT NULL,
	"section_id" "section_id",
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"raw_score" integer,
	"raw_total" integer,
	"predicted_score_out_of_150" real
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "section_ability_estimates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"section_id" "section_id" NOT NULL,
	"theta" real NOT NULL,
	"standard_error" real NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "friend_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"status" "friend_request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id_low" uuid NOT NULL,
	"user_id_high" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_ordered_pair_check" CHECK ("friendships"."user_id_low" < "friendships"."user_id_high")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_deletion_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_deletion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fencing_token" integer DEFAULT 0 NOT NULL,
	"lease_holder" text,
	"lease_expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"tombstoned" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "questions" ADD CONSTRAINT "questions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quiz_attempt_questions" ADD CONSTRAINT "quiz_attempt_questions_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quiz_attempt_questions" ADD CONSTRAINT "quiz_attempt_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "section_ability_estimates" ADD CONSTRAINT "section_ability_estimates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_id_low_users_id_fk" FOREIGN KEY ("user_id_low") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_id_high_users_id_fk" FOREIGN KEY ("user_id_high") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_deletion_challenges" ADD CONSTRAINT "account_deletion_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_deletion_jobs" ADD CONSTRAINT "account_deletion_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_identities_provider_subject_idx" ON "auth_identities" USING btree ("provider","provider_subject");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "questions_paper_section_status_idx" ON "questions" USING btree ("paper_id","section_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quiz_attempt_questions_attempt_order_idx" ON "quiz_attempt_questions" USING btree ("attempt_id","order_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quiz_attempt_questions_question_idx" ON "quiz_attempt_questions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quiz_attempts_user_started_at_idx" ON "quiz_attempts" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "section_ability_estimates_user_section_idx" ON "section_ability_estimates" USING btree ("user_id","section_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "friend_requests_from_to_idx" ON "friend_requests" USING btree ("from_user_id","to_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friend_requests_to_user_idx" ON "friend_requests" USING btree ("to_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "friendships_pair_idx" ON "friendships" USING btree ("user_id_low","user_id_high");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_deletion_challenges_user_idx" ON "account_deletion_challenges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_deletion_jobs_user_idx" ON "account_deletion_jobs" USING btree ("user_id");