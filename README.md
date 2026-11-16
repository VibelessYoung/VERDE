# Verde — GitHub Contribution Art Studio

یک اپلیکیشن تک‌صفحه‌ای با Next.js و TypeScript برای طراحی گراف مشارکت GitHub و ساخت بسته‌ی GitHub Actions جهت اعمال طرح با کامیت‌های زمان‌بندی‌شده.

## Stack

- Next.js 16.4.6 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4 (PostCSS)
- JSZip برای ساخت بسته‌ی نصب‌شدنی در مرورگر
- Lucide React برای آیکون‌ها

## اجرا

پیش‌نیاز: Node.js نسخه 20.9 یا جدیدتر (Node.js 24 پیشنهاد می‌شود).

```bash
npm install
npm run dev
```

سپس `http://localhost:3000` را باز کن.

## دستورات بررسی

```bash
npm run typecheck
npm run lint
npm run build
```

## خروجی GitHub چه می‌کند؟

از بخش «خروجی برای GitHub» یک ایمیل تأییدشده و نام نویسنده وارد کن. فایل ZIP شامل Workflow، فایل JSON طرح، اسکریپت Node.js و راهنمای نصب است. آن‌ها را به ریشه‌ی یک ریپوی مستقل روی شاخه‌ی پیش‌فرض اضافه کن و Workflow را یک بار با حالت `backfill` اجرا کن. پس از آن، workflow روزانه خانه‌ی همان روز را پردازش می‌کند.

این ابزار رنگ Contribution Graph را مستقیماً تغییر نمی‌دهد؛ GitHub رنگ را با تعداد contributionها و مقیاس داخلی خود محاسبه می‌کند. بسته تعداد کامیت هر سطح را کنترل می‌کند. برای شرایط دقیق انتساب contributionها، راهنمای رسمی GitHub را بخوان: https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference

## حریم خصوصی

طرح و تنظیمات به‌صورت محلی در مرورگر ذخیره می‌شوند. این پروژه به API گیت‌هاب متصل نمی‌شود و از کاربر PAT، رمز عبور یا OAuth token نمی‌گیرد. ZIP در همان مرورگر ساخته می‌شود.
