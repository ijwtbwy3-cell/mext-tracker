CREATE TABLE "diary" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"mood" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_days" (
	"id" integer PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"phase" integer NOT NULL,
	"kind" text NOT NULL,
	"budget_min" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress" (
	"topic_id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"title" text NOT NULL,
	"ord" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"short" text NOT NULL,
	"exam" text NOT NULL,
	"color" text NOT NULL,
	"icon" text NOT NULL,
	"ord" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"day_id" integer NOT NULL,
	"subject_id" text,
	"topic_id" text,
	"topic_ids" text NOT NULL,
	"exam_key" text,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"minutes" integer NOT NULL,
	"ord" integer NOT NULL,
	"status" text NOT NULL,
	"done_at" timestamp with time zone,
	"spent_min" integer,
	"awarded_xp" integer NOT NULL,
	"awarded_coins" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"section_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"hours" real NOT NULL,
	"difficulty" integer NOT NULL,
	"level" text NOT NULL,
	"ord" integer NOT NULL
);
