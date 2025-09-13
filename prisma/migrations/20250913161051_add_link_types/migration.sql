-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."courses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."course_links" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "course_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bases" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "is_single_room" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rooms" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "base_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."weeks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "weekday" INTEGER NOT NULL,
    "period_start" INTEGER NOT NULL,
    "period_end" INTEGER NOT NULL,
    "course_id" TEXT,
    "course_name" TEXT,
    "base_id" TEXT,
    "room_id" TEXT,
    "base_name" TEXT,
    "room_name" TEXT,
    "address" TEXT,
    "override_title" BOOLEAN NOT NULL DEFAULT false,
    "override_location" BOOLEAN NOT NULL DEFAULT false,
    "calendar_event_id" TEXT,
    "series_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."link_types" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "courses_user_id_idx" ON "public"."courses"("user_id");

-- CreateIndex
CREATE INDEX "course_links_course_id_idx" ON "public"."course_links"("course_id");

-- CreateIndex
CREATE INDEX "bases_user_id_idx" ON "public"."bases"("user_id");

-- CreateIndex
CREATE INDEX "rooms_user_id_idx" ON "public"."rooms"("user_id");

-- CreateIndex
CREATE INDEX "rooms_base_id_idx" ON "public"."rooms"("base_id");

-- CreateIndex
CREATE INDEX "weeks_user_id_week_start_idx" ON "public"."weeks"("user_id", "week_start");

-- CreateIndex
CREATE UNIQUE INDEX "weeks_user_id_week_start_key" ON "public"."weeks"("user_id", "week_start");

-- CreateIndex
CREATE INDEX "events_user_id_week_start_idx" ON "public"."events"("user_id", "week_start");

-- CreateIndex
CREATE INDEX "events_course_id_idx" ON "public"."events"("course_id");

-- CreateIndex
CREATE INDEX "events_base_id_idx" ON "public"."events"("base_id");

-- CreateIndex
CREATE INDEX "events_room_id_idx" ON "public"."events"("room_id");

-- CreateIndex
CREATE INDEX "events_calendar_event_id_idx" ON "public"."events"("calendar_event_id");

-- CreateIndex
CREATE INDEX "events_series_id_idx" ON "public"."events"("series_id");

-- CreateIndex
CREATE INDEX "link_types_user_id_idx" ON "public"."link_types"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "link_types_user_id_name_key" ON "public"."link_types"("user_id", "name");

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."courses" ADD CONSTRAINT "courses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."course_links" ADD CONSTRAINT "course_links_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bases" ADD CONSTRAINT "bases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rooms" ADD CONSTRAINT "rooms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rooms" ADD CONSTRAINT "rooms_base_id_fkey" FOREIGN KEY ("base_id") REFERENCES "public"."bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."weeks" ADD CONSTRAINT "weeks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_user_id_week_start_fkey" FOREIGN KEY ("user_id", "week_start") REFERENCES "public"."weeks"("user_id", "week_start") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_base_id_fkey" FOREIGN KEY ("base_id") REFERENCES "public"."bases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."link_types" ADD CONSTRAINT "link_types_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
