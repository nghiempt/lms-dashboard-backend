-- CreateTable
CREATE TABLE "course_landing_page" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VNĐ',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "badge" TEXT,
    "features" JSONB NOT NULL DEFAULT '[]',
    "tag" TEXT,
    "accessLabel" TEXT NOT NULL DEFAULT 'trọn đời',
    "supportLabel" TEXT NOT NULL DEFAULT '1:1',
    "ctaUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_landing_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_landing_page_chapters" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_landing_page_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_landing_page_lessons" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "videoUrl" TEXT,
    "duration" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_landing_page_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_landing_page_slug_key" ON "course_landing_page"("slug");

-- CreateIndex
CREATE INDEX "course_landing_page_chapters_courseId_idx" ON "course_landing_page_chapters"("courseId");

-- CreateIndex
CREATE INDEX "course_landing_page_lessons_chapterId_idx" ON "course_landing_page_lessons"("chapterId");

-- AddForeignKey
ALTER TABLE "course_landing_page_chapters" ADD CONSTRAINT "course_landing_page_chapters_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course_landing_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_landing_page_lessons" ADD CONSTRAINT "course_landing_page_lessons_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "course_landing_page_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
