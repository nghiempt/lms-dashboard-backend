/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { seedLandingCourses } from './seed-landing';

const prisma = new PrismaClient();

/** Danh sách permission cơ bản theo 17 nhóm chức năng. */
const PERMISSIONS = [
  'student.read', 'student.create', 'student.update', 'student.lock',
  'admin.manage', 'role.manage',
  'course.read', 'course.create', 'course.update', 'course.delete',
  'order.read', 'order.confirm',
  'media.manage', 'document.manage', 'content.manage', 'landing.manage', 'menu.manage',
  'notification.send', 'community.manage', 'settings.manage',
  'stats.read', 'accesslog.read', 'device.manage',
];

async function main() {
  // Guard: không seed dữ liệu demo (admin@admin.com/admin123, student@lms.com…)
  // lên môi trường production trừ khi được phép tường minh.
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_PROD_SEED !== 'true'
  ) {
    console.error(
      '⛔ Từ chối seed trên production. Đặt ALLOW_PROD_SEED=true nếu thực sự muốn chạy.',
    );
    process.exit(1);
  }

  console.log('🌱 Seeding...');

  // ----- PERMISSIONS -----
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, description: key },
      update: {},
    });
  }

  // ----- ROLES -----
  const superAdmin = await prisma.adminRole.upsert({
    where: { name: 'SUPER_ADMIN' },
    create: { name: 'SUPER_ADMIN', description: 'Toàn quyền hệ thống' },
    update: {},
  });

  // ----- ADMIN ACCOUNT -----
  const adminPass = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@admin.com' },
    create: {
      email: 'admin@admin.com',
      fullName: 'Quản trị viên',
      passwordHash: adminPass,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
    update: {},
  });
  await prisma.adminRoleAssignment.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdmin.id } },
    create: { userId: admin.id, roleId: superAdmin.id },
    update: {},
  });

  // ----- STUDENT ACCOUNT -----
  const studentPass = await bcrypt.hash('student123', 10);
  const student = await prisma.user.upsert({
    where: { email: 'student@lms.com' },
    create: {
      email: 'student@lms.com',
      fullName: 'Tuấn Kiệt',
      phone: '0901234567',
      passwordHash: studentPass,
      role: 'STUDENT',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
    update: {},
  });

  // ----- COURSES -----
  const premium = await prisma.course.upsert({
    where: { slug: 'khoa-premium' },
    create: {
      slug: 'khoa-premium',
      title: 'Khóa Premium',
      shortCode: 'KP',
      coverLabel: 'Devin Jatho',
      subtitle: 'Lộ trình editor chuyên nghiệp',
      pricing: 'PAID',
      price: 5890000,
      status: 'PUBLISHED',
      isFeatured: true,
      order: 1,
      publishedAt: new Date(),
    },
    update: {},
  });
  const elite = await prisma.course.upsert({
    where: { slug: 'khoa-premium-elite' },
    create: {
      slug: 'khoa-premium-elite',
      title: 'Khóa Premium Elite',
      shortCode: 'PE',
      coverLabel: 'Premium Elite',
      subtitle: 'Nâng cao cho client quốc tế',
      pricing: 'PAID',
      price: 10890000,
      status: 'PUBLISHED',
      isFeatured: true,
      order: 2,
      publishedAt: new Date(),
    },
    update: {},
  });

  // chapters + lessons cho Khóa Premium
  for (let c = 1; c <= 2; c++) {
    const chapter = await prisma.chapter.create({
      data: { courseId: premium.id, title: `Chương ${c}`, order: c },
    });
    for (let l = 1; l <= 3; l++) {
      await prisma.lesson.create({
        data: {
          chapterId: chapter.id,
          title: `Bài ${c}.${l}`,
          type: 'VIDEO',
          durationSec: 600,
          isPreview: c === 1 && l === 1,
          order: l,
        },
      });
    }
  }

  // ----- ENROLLMENT (student đã mua Khóa Premium) -----
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: student.id, courseId: premium.id } },
    create: {
      userId: student.id,
      courseId: premium.id,
      status: 'LEARNING',
      progressPct: 62,
    },
    update: {},
  });

  // ----- COMMUNITY -----
  await prisma.communityGroup.createMany({
    data: [
      { name: 'Việc làm Editor Freelance', category: 'Việc làm', memberCount: 12400, order: 1 },
      { name: 'Editor Upwork & IG Việt Nam', category: 'Quốc tế', memberCount: 8700, order: 2 },
    ],
    skipDuplicates: true,
  });

  // ----- DOCUMENTS (kho tài liệu) -----
  const existingDocs = await prisma.document.count();
  if (existingDocs === 0) {
    await prisma.document.createMany({
      data: [
        { title: 'Devin Jatho Cheatsheet.pdf', kind: 'PDF', fileType: 'PDF', sizeBytes: 2516582, category: 'Tài liệu', courseId: premium.id, isPublic: true, order: 1 },
        { title: 'Cinematic LUT Pack', kind: 'FILE', fileType: 'LUT · .cube', sizeBytes: 18874368, category: 'Preset', courseId: premium.id, isPublic: true, order: 2 },
        { title: '100 Hook Ideas.pdf', kind: 'PDF', fileType: 'PDF', sizeBytes: 1153433, category: 'Tài liệu', isPublic: true, order: 3 },
      ],
    });
  }

  // ----- NOTIFICATION mẫu -----
  const existingNoti = await prisma.notification.count();
  if (existingNoti === 0) {
    await prisma.notification.create({
      data: {
        title: 'Chào mừng đến VIDEO EDITOR',
        body: 'Bắt đầu lộ trình học của bạn ngay hôm nay!',
        type: 'SYSTEM',
        scope: 'USER',
        status: 'SENT',
        sentAt: new Date(),
        senderId: admin.id,
        recipients: { create: [{ userId: student.id }] },
      },
    });
  }

  // ----- SYSTEM SETTINGS -----
  const settings = [
    { key: 'site.name', value: 'VIDEO EDITOR LMS', group: 'general', label: 'Tên website' },
    { key: 'contact.hotline', value: '0900000000', group: 'contact', label: 'Hotline' },
    { key: 'social.facebook', value: 'https://facebook.com/', group: 'social', label: 'Facebook' },
  ];
  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      create: s,
      update: {},
    });
  }

  // ----- LANDING PAGE COURSES (tách biệt với Course thật) -----
  await seedLandingCourses(prisma);

  console.log('✅ Seed done.');
  console.log('   Admin:   admin@admin.com / admin123');
  console.log('   Student: student@lms.com / student123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
