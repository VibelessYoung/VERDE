export const WEEKS = 53;
export const DAYS_PER_WEEK = 7;
export const LEVELS = 4;
export const PALETTE = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"] as const;
export const DEFAULT_COMMITS_PER_LEVEL = [0, 1, 2, 4, 7] as const;

export type ContributionGrid = number[][];
export type CommitsPerLevel = [number, number, number, number, number];

export type ContributionPlan = {
  schemaVersion: 1;
  product: "contribution-art-studio";
  createdAt: string;
  startDate: string;
  weeks: number;
  daysPerWeek: number;
  // weeks[weekIndex][dayIndex], where dayIndex 0 = Sunday.
  cells: ContributionGrid;
  commitsPerLevel: CommitsPerLevel;
  authorName: string;
  authorEmail: string;
  timezone: "UTC";
};

export function makeDateRange(reference = new Date()) {
  const today = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));
  const firstVisible = new Date(today);
  firstVisible.setUTCDate(firstVisible.getUTCDate() - 364);
  firstVisible.setUTCDate(firstVisible.getUTCDate() - firstVisible.getUTCDay());
  const startDate = firstVisible.toISOString().slice(0, 10);
  const dates: string[][] = [];

  for (let week = 0; week < WEEKS; week += 1) {
    const weekDates: string[] = [];
    for (let day = 0; day < DAYS_PER_WEEK; day += 1) {
      const date = new Date(firstVisible);
      date.setUTCDate(firstVisible.getUTCDate() + week * 7 + day);
      weekDates.push(date.toISOString().slice(0, 10));
    }
    dates.push(weekDates);
  }

  return { startDate, dates, today: today.toISOString().slice(0, 10) };
}

export function emptyGrid(): ContributionGrid {
  return Array.from({ length: WEEKS }, () => Array<number>(DAYS_PER_WEEK).fill(0));
}

export function createDemoGrid(): ContributionGrid {
  const grid = emptyGrid();
  for (let week = 0; week < WEEKS; week += 1) {
    const waveA = 2.8 + Math.sin(week * 0.31) * 1.35;
    const waveB = 3.2 + Math.cos(week * 0.19 + 1.2) * 1.7;
    for (let day = 0; day < DAYS_PER_WEEK; day += 1) {
      const distanceA = Math.abs(day - waveA);
      const distanceB = Math.abs(day - waveB);
      if (distanceA < 0.55) grid[week][day] = 4;
      else if (distanceA < 1.2) grid[week][day] = 2;
      else if (distanceB < 0.7) grid[week][day] = 3;
      else if (distanceB < 1.35) grid[week][day] = 1;
    }
  }
  return grid;
}

export function isValidGrid(value: unknown): value is ContributionGrid {
  return (
    Array.isArray(value) &&
    value.length === WEEKS &&
    value.every(
      (week) =>
        Array.isArray(week) &&
        week.length === DAYS_PER_WEEK &&
        week.every((level) => Number.isInteger(level) && level >= 0 && level <= LEVELS),
    )
  );
}

export function countCells(grid: ContributionGrid) {
  return grid.reduce(
    (result, week) => {
      week.forEach((level) => {
        if (level > 0) result.active += 1;
        result.levels[level] += 1;
      });
      return result;
    },
    { active: 0, levels: [0, 0, 0, 0, 0] },
  );
}

export function estimateCommits(grid: ContributionGrid, commitsPerLevel: CommitsPerLevel) {
  return grid.reduce(
    (total, week) => total + week.reduce((weekTotal, level) => weekTotal + commitsPerLevel[level], 0),
    0,
  );
}

export function formatDate(date: string, locale = "fa-IR") {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function getMonthLabels(dates: string[][]) {
  const labels: Array<{ week: number; label: string }> = [];
  let previousMonth = "";
  dates.forEach((week, weekIndex) => {
    const date = new Date(`${week[0]}T12:00:00Z`);
    const monthKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    if (monthKey !== previousMonth) {
      labels.push({
        week: weekIndex,
        label: new Intl.DateTimeFormat("fa-IR", { month: "short", timeZone: "UTC" }).format(date),
      });
      previousMonth = monthKey;
    }
  });
  return labels;
}
