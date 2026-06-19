-- Section (Nhóm bài) — cấp trung gian Chương → Nhóm bài → Bài. Bổ sung, không phá dữ liệu cũ.

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- AlterTable (nullable → không ảnh hưởng bài học hiện có)
ALTER TABLE "lessons" ADD COLUMN "sectionId" TEXT;

-- CreateIndex
CREATE INDEX "sections_chapterId_idx" ON "sections"("chapterId");
CREATE INDEX "lessons_sectionId_idx" ON "lessons"("sectionId");

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
