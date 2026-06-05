/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';

/**
 * Seed 2 khoá hiển thị trên Landing Page (bảng course_landing_page).
 * Tách biệt HOÀN TOÀN với model Course của hệ thống học thật.
 *
 * Idempotent: upsert phần "card" (giá, features, tag...); chỉ tạo
 * chapters/lessons khi khoá CHƯA có chương nào — để chạy lại seed không
 * ghi đè nội dung admin đã chỉnh sửa.
 *
 * Có thể chạy độc lập (không đụng tới dữ liệu Course thật):
 *   npx ts-node prisma/seed-landing.ts
 */

const CTA = 'https://lms-dashboard.niandemo.site/login';

const FOUNDATION = {
  label: 'Foundation',
  name: 'Nhập môn & Tư duy nghề',
  description:
    'Định vị bản thân, hiểu thị trường quốc tế và tư duy của một editor chuyên nghiệp.',
  lessons: [
    { title: 'Chào mừng & lộ trình khóa học', duration: '04:30' },
    { title: 'Định vị bản thân trong thị trường quốc tế', duration: '12:10' },
    { title: 'Tư duy của một editor chuyên nghiệp', duration: '09:45' },
    { title: 'Cách định giá video & nhận job', duration: '11:20' },
    { title: 'Setup & bộ công cụ ban đầu', duration: '07:15' },
  ],
};
const DEVIN = {
  label: 'Devin Jatho',
  name: 'Devin Jatho Style',
  description:
    'Giải mã DNA của style Devin Jatho: pacing, sound design và chuyển động.',
  lessons: [
    { title: 'Phân tích DNA style Devin Jatho', duration: '14:05' },
    { title: 'Pacing & nhịp cắt', duration: '13:30' },
    { title: 'Sound design & SFX', duration: '12:50' },
    { title: 'Transition & motion nâng cao', duration: '16:20' },
    { title: 'Thực hành: dựng video theo style', duration: '22:00' },
  ],
};
const APPLE = {
  label: 'Apple Style',
  name: 'Apple Style',
  description: 'Tư duy minimal, clean type motion và bố cục chuẩn Apple.',
  lessons: [
    { title: 'Tư duy minimal & clean', duration: '10:15' },
    { title: 'Clean type motion', duration: '15:40' },
    { title: 'Bố cục & khoảng thở', duration: '09:30' },
    { title: 'Color & tone kiểu Apple', duration: '12:25' },
    { title: 'Thực hành: clip kiểu Apple', duration: '20:10' },
  ],
};
const PR_AE = {
  label: 'Pr & Ae',
  name: 'Làm chủ Premiere & After Effects',
  description: 'Workflow Premiere tối ưu và After Effects căn bản cho editor.',
  lessons: [
    { title: 'Workflow Premiere Pro tối ưu', duration: '13:00' },
    { title: 'Keyframe & đồ thị tốc độ', duration: '11:45' },
    { title: 'After Effects căn bản cho editor', duration: '18:20' },
    { title: 'Dynamic Link Pr ↔ Ae', duration: '08:55' },
  ],
};
const COLOR_MOTION = {
  label: 'Color & Motion',
  name: 'Màu sắc, bố cục & chuyển động',
  description:
    'Nền tảng color grading, nguyên tắc bố cục và tư duy chuyển động.',
  lessons: [
    { title: 'Nền tảng color grading', duration: '14:30' },
    { title: 'LUT & node grading', duration: '12:10' },
    { title: 'Nguyên tắc bố cục khung hình', duration: '10:40' },
    { title: 'Tư duy chuyển động (motion)', duration: '13:15' },
  ],
};
const WORKFLOW = {
  label: 'Workflow',
  name: 'Workflow tối ưu & xuất bản',
  description: 'Sắp xếp project, preset tăng tốc và xuất video chuẩn nền tảng.',
  lessons: [
    { title: 'Sắp xếp project & đặt tên', duration: '07:50' },
    { title: 'Preset & template tăng tốc', duration: '11:05' },
    { title: 'Phím tắt & thói quen pro', duration: '09:20' },
    { title: 'Xuất video chuẩn nền tảng', duration: '08:40' },
  ],
};

const COURSES = [
  {
    slug: 'premium',
    title: 'Khóa Premium',
    price: '5.890.000',
    featured: false,
    badge: null as string | null,
    order: 1,
    tag: 'Toàn bộ kỹ năng talking head nâng cao — Devin Jatho & Apple Style, kèm hỗ trợ sửa bài 1:1 và update trọn đời.',
    features: [
      'Toàn bộ kỹ năng talking head nâng cao (Devin Jatho & Apple Style)',
      'Toàn bộ quy trình tìm & làm việc với khách hàng quốc tế',
      'Hỗ trợ sửa bài chi tiết 1:1, bám sát lộ trình học viên',
      'Đảm bảo đầu ra về kỹ năng',
      'Tặng kho tài nguyên + ý tưởng trị giá $500',
      'Update trọn đời các style trending quốc tế',
    ],
    chapters: [FOUNDATION, DEVIN, APPLE, PR_AE, COLOR_MOTION, WORKFLOW],
  },
  {
    slug: 'premium-elite',
    title: 'Khóa Premium Elite',
    price: '10.890.000',
    featured: true,
    badge: 'Giới hạn mỗi tháng',
    order: 2,
    tag: 'Toàn bộ khóa Premium + xây dựng portfolio, quy trình client quốc tế và coaching thực chiến 1:1.',
    features: [
      'Sở hữu toàn bộ khóa Premium',
      'Hỗ trợ 1:1 xây dựng portfolio, tư vấn & định hướng cá nhân',
      'Hỗ trợ làm job thực chiến khi hoàn thành 1/2 lộ trình',
      'Lộ trình đặc biệt để khách tự tìm đến bạn, thay vì cạnh tranh giá rẻ trên Upwork',
      'Đảm bảo đầu ra làm việc được trên nền tảng quốc tế & tự hoàn vốn học phí',
    ],
    chapters: [
      FOUNDATION,
      DEVIN,
      APPLE,
      PR_AE,
      COLOR_MOTION,
      WORKFLOW,
      {
        label: 'Portfolio',
        name: 'Xây dựng Portfolio cá nhân',
        description: 'Dựng showreel ấn tượng và personal branding để nổi bật.',
        lessons: [
          { title: 'Chọn & dựng showreel', duration: '15:00' },
          { title: 'Thiết kế portfolio site', duration: '12:30' },
          { title: 'Personal branding cho editor', duration: '10:15' },
        ],
      },
      {
        label: 'Global Client',
        name: 'Tìm & làm việc với client quốc tế',
        description: 'Quy trình Upwork A–Z và cách để client tự tìm đến bạn.',
        lessons: [
          { title: 'Upwork từ A đến Z', duration: '16:40' },
          { title: 'Hồ sơ & proposal thắng job', duration: '13:20' },
          { title: 'Giao tiếp & quản lý client', duration: '11:50' },
          { title: 'Để client tự tìm đến bạn', duration: '14:10' },
        ],
      },
      {
        label: 'Coaching 1:1',
        name: 'Coaching & thực chiến 1:1',
        description:
          'Review portfolio 1:1, hỗ trợ làm job thực tế và định hướng cá nhân.',
        lessons: [
          { title: 'Review portfolio 1:1', duration: '1:1' },
          { title: 'Hỗ trợ làm job thực chiến', duration: '1:1' },
          { title: 'Định hướng cá nhân hóa', duration: '1:1' },
        ],
      },
    ],
  },
];

export async function seedLandingCourses(prisma: PrismaClient): Promise<void> {
  for (const c of COURSES) {
    const course = await prisma.landingCourse.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        title: c.title,
        price: c.price,
        featured: c.featured,
        badge: c.badge ?? undefined,
        features: c.features,
        tag: c.tag,
        ctaUrl: CTA,
        order: c.order,
      },
      update: {
        title: c.title,
        price: c.price,
        featured: c.featured,
        badge: c.badge ?? null,
        features: c.features,
        tag: c.tag,
        ctaUrl: CTA,
        order: c.order,
      },
    });

    const chapterCount = await prisma.landingCourseChapter.count({
      where: { courseId: course.id },
    });
    if (chapterCount === 0) {
      for (let ci = 0; ci < c.chapters.length; ci++) {
        const ch = c.chapters[ci];
        await prisma.landingCourseChapter.create({
          data: {
            courseId: course.id,
            label: ch.label,
            name: ch.name,
            description: ch.description,
            order: ci,
            lessons: {
              create: ch.lessons.map((l, li) => ({
                title: l.title,
                duration: l.duration,
                videoUrl: '', // admin điền URL video sau
                order: li,
              })),
            },
          },
        });
      }
    }
  }
}

// Cho phép chạy độc lập: chỉ seed Landing Page, không đụng dữ liệu khác.
if (require.main === module) {
  const prisma = new PrismaClient();
  seedLandingCourses(prisma)
    .then(() => console.log('✅ Seed landing courses done.'))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
