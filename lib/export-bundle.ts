import type { ContributionPlan } from "@/lib/plan";

export function buildGithubWorkflow() {
  return `name: Contribution Art

on:
  schedule:
    # GitHub Actions schedules use UTC. This runs once per day.
    - cron: "17 12 * * *"
  workflow_dispatch:
    inputs:
      mode:
        description: "Backfill every planned past day, or process today only"
        required: true
        default: backfill
        type: choice
        options:
          - backfill
          - today

permissions:
  contents: write

concurrency:
  group: contribution-art
  cancel-in-progress: false

jobs:
  paint:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Check out the default branch
        uses: actions/checkout@v7

      - name: Set up Node.js
        uses: actions/setup-node@v7
        with:
          node-version: 24

      - name: Verify default branch
        env:
          DEFAULT_BRANCH: \${{ github.event.repository.default_branch || github.ref_name }}
        run: |
          if [ "$GITHUB_REF_NAME" != "$DEFAULT_BRANCH" ]; then
            echo "::error::Run this workflow from the repository default branch (\$DEFAULT_BRANCH)."
            exit 1
          fi

      - name: Apply the contribution plan
        run: node scripts/apply-contribution-plan.mjs "\${{ github.event_name == 'workflow_dispatch' && inputs.mode || 'today' }}"

      - name: Push generated commits
        run: git push
`;
}

export function buildRunnerScript() {
  return `import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const PLAN_PATH = "contribution-plan.json";
const LOG_PATH = "contribution-art.log";
const MAX_COMMITS_PER_RUN = 5000;

function fail(message) {
  console.error("\\nContribution Art: " + message);
  process.exit(1);
}

function runGit(args, env = process.env) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env }).trim();
}

if (!existsSync(PLAN_PATH)) fail("contribution-plan.json was not found in the repository root.");
const plan = JSON.parse(readFileSync(PLAN_PATH, "utf8"));

if (plan.schemaVersion !== 1 || plan.product !== "contribution-art-studio") {
  fail("Unsupported plan format. Export a fresh package from Verde.");
}
if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(plan.startDate || "")) fail("The plan startDate is invalid.");
if (!Array.isArray(plan.cells) || plan.cells.length !== 53 || plan.cells.some((week) => !Array.isArray(week) || week.length !== 7)) {
  fail("The plan must contain a 53 × 7 contribution grid.");
}
if (!Array.isArray(plan.commitsPerLevel) || plan.commitsPerLevel.length !== 5) {
  fail("commitsPerLevel must contain five values (levels 0 to 4).");
}
if (!plan.authorName || !plan.authorEmail || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(plan.authorEmail)) {
  fail("Set authorName and a valid, GitHub-verified authorEmail in contribution-plan.json.");
}

const commitsPerLevel = plan.commitsPerLevel.map(Number);
if (commitsPerLevel[0] !== 0 || commitsPerLevel.some((count) => !Number.isInteger(count) || count < 0 || count > 20)) {
  fail("Commit counts must be integers from 0 to 20, and level 0 must be 0.");
}

const mode = process.argv[2] || "today";
if (mode !== "today" && mode !== "backfill") fail("Mode must be 'today' or 'backfill'.");
const today = new Date().toISOString().slice(0, 10);
const start = new Date(plan.startDate + "T00:00:00.000Z");
const plannedDays = [];

for (let week = 0; week < 53; week += 1) {
  for (let day = 0; day < 7; day += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + week * 7 + day);
    const dateString = date.toISOString().slice(0, 10);
    const level = Number(plan.cells[week][day]);
    if (!Number.isInteger(level) || level < 0 || level > 4) fail("A cell contains an invalid contribution level.");
    if (level === 0) continue;
    if (dateString > today) continue;
    if (mode === "today" && dateString !== today) continue;
    plannedDays.push({ date: dateString, level, target: commitsPerLevel[level] });
  }
}

const totalToGenerate = plannedDays.reduce((sum, day) => sum + day.target, 0);
if (totalToGenerate > MAX_COMMITS_PER_RUN) {
  fail("This run would create " + totalToGenerate + " commits, above the safety limit of " + MAX_COMMITS_PER_RUN + ". Lower the commit counts or run a smaller plan.");
}

let log = existsSync(LOG_PATH) ? readFileSync(LOG_PATH, "utf8") : "";
if (!log && totalToGenerate > 0) log = "# Contribution Art activity log\\n\\n";
const generatedByDate = new Map();
for (const line of log.split(/\\r?\\n/)) {
  const match = line.match(/^(\\d{4}-\\d{2}-\\d{2}) #([1-9]\\d*) \\|/);
  if (match) generatedByDate.set(match[1], Math.max(generatedByDate.get(match[1]) || 0, Number(match[2])));
}

let created = 0;
for (const day of plannedDays) {
  const alreadyCreated = generatedByDate.get(day.date) || 0;
  if (alreadyCreated >= day.target) continue;

  for (let sequence = alreadyCreated + 1; sequence <= day.target; sequence += 1) {
    const entry = day.date + " #" + sequence + " | level " + day.level + " | generated by Verde Contribution Art\\n";
    log += entry;
    writeFileSync(LOG_PATH, log, "utf8");

    const commitDate = new Date(day.date + "T12:00:00.000Z");
    commitDate.setUTCSeconds(commitDate.getUTCSeconds() + sequence - 1);
    const isoDate = commitDate.toISOString();
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: plan.authorName,
      GIT_AUTHOR_EMAIL: plan.authorEmail,
      GIT_COMMITTER_NAME: "github-actions[bot]",
      GIT_COMMITTER_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com",
      GIT_AUTHOR_DATE: isoDate,
      GIT_COMMITTER_DATE: isoDate,
    };

    runGit(["add", LOG_PATH]);
    runGit(["commit", "-m", "chore: contribution art " + day.date + " [" + sequence + "/" + day.target + "]"], env);
    created += 1;
  }
  generatedByDate.set(day.date, day.target);
}

if (created === 0) {
  console.log(mode === "today"
    ? "No new commits are planned for today (" + today + ")."
    : "The historical part of this plan is already applied. No new commits were needed.");
} else {
  console.log("Created " + created + " contribution commit(s). The workflow will push them to the checked-out branch.");
}
`;
}

export function buildExportReadme(plan: ContributionPlan, totalCommits: number) {
  return `# بسته GitHub Contribution Art

این بسته توسط **Verde — GitHub Contribution Art Studio** ساخته شده است.

## داخل بسته

- \\.github/workflows/contribution-art.yml — اجرای روزانه با GitHub Actions
- contribution-plan.json — طرح ۵۳ هفته‌ای، سطوح رنگ و ایمیل نویسنده
- scripts/apply-contribution-plan.mjs — ساخت کامیت‌های واقعی و قابل انتساب به اکانت

## راه‌اندازی

۱. فایل‌های بسته را بدون تغییر ساختار، در ریشه یک ریپوی مستقل GitHub کپی کن.

۲. مقدار \`authorEmail\` در \`contribution-plan.json\` باید ایمیلی باشد که در GitHub به اکانتت اضافه و تأیید شده است. آدرس noreply را هم می‌توانی از [تنظیمات ایمیل GitHub](https://github.com/settings/emails) برداری. نام نویسنده در \`authorName\` قابل تغییر است.

۳. مطمئن شو ریپو روی شاخه پیش‌فرض خودش قرار دارد و Workflowها در **Settings → Actions → General** غیرفعال نشده‌اند و مجوز Workflow برای نوشتن محتوا فعال است. اگر Branch protection مانع push مستقیم است، باید Rule آن را هم تنظیم کنی. این بسته به Personal Access Token نیاز ندارد؛ از \`GITHUB_TOKEN\` خود GitHub Actions استفاده می‌کند.

۴. فایل‌ها را روی شاخه پیش‌فرض commit و push کن.

۵. در تب **Actions → Contribution Art**، اجرای دستی را با گزینه **backfill** شروع کن. این اجرا خانه‌های گذشته‌ی موجود در طرح را با تاریخ واقعی همان روزها تکمیل می‌کند.

۶. از آن به بعد Workflow روزی یک بار، ساعت **12:17 UTC** اجرا می‌شود و فقط خانه‌ی مربوط به همان روز را تکمیل می‌کند. خانه‌های آینده پس از رسیدن تاریخشان ثبت خواهند شد.

## شرایط مهم GitHub

- برای دیده‌شدن کامیت در Contribution Graph، ایمیل نویسنده باید به حساب GitHub متصل باشد و کامیت در ریپوی مستقل روی شاخه پیش‌فرض (یا شاخه \`gh-pages\`) قرار بگیرد.
- GitHub رنگ خانه را از تعداد contributionها و مقیاس داخلی خودش تعیین می‌کند؛ هیچ API عمومی برای تنظیم مستقیم رنگ یک خانه وجود ندارد. این طرح تعداد کامیت هر سطح را کنترل می‌کند، اما تطابق صددرصدی رنگ تضمین‌شدنی نیست.
- اجرای backfill کامیت‌هایی با تاریخ نویسندگی گذشته می‌سازد. تعداد برآوردشده برای این طرح: **${totalCommits.toLocaleString("en-US")}** کامیت در کل بازه، در صورتی که همه‌ی روزهای طرح تا امروز اعمال شوند.
- تغییر طرح بعد از backfill، کامیت‌های قبلی را حذف نمی‌کند. کاهش contributionهای ثبت‌شده نیازمند حذف/بازنویسی تاریخچه‌ی commitهای تولیدشده است؛ صرفاً تغییر JSON کافی نیست.
- GitHub ممکن است اجرای زمان‌بندی را کمی عقب بیندازد. همچنین زمان Contribution Graph بر مبنای UTC تفسیر می‌شود.
- اگر حساب ایمیل را تأیید نکرده باشد، ریپو fork باشد، یا Workflow روی شاخه‌ی غیرپیش‌فرض اجرا شود، ممکن است کامیت‌ها در گراف پروفایل ظاهر نشوند. برای ریپوی خصوصی نیز تنظیم نمایش مشارکت‌های خصوصی پروفایل را بررسی کن.

## تنظیمات فعلی

- شروع بازه: \`${plan.startDate}\`
- سطح ۱ تا ۴: \`${plan.commitsPerLevel.slice(1).join(" / ")}\` کامیت در هر روز
- نویسنده: \`${plan.authorName}\`
- ایمیل نویسنده: \`${plan.authorEmail}\`

## توقف اتوماسیون

در GitHub به **Actions → Contribution Art → ⋯ → Disable workflow** برو، یا فایل \`.github/workflows/contribution-art.yml\` را حذف کن.

---

ساخته‌شده با Verde. این ابزار صرفاً کامیت‌های ثبت‌شده در ریپوی خودت را مدیریت می‌کند و هیچ دسترسی مستقیمی به حساب GitHub تو دریافت نمی‌کند.
`;
}
