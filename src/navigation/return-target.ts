import type { Href } from "expo-router";

export type ReturnTarget =
  | "accounts"
  | "calendar"
  | "groups"
  | "import"
  | "insights"
  | "people"
  | "settings"
  | "shared"
  | "timeline";

const returnTargetRoutes: Record<ReturnTarget, Href> = {
  accounts: "/accounts",
  calendar: "/calendar",
  groups: "/groups",
  import: "/import",
  insights: "/insights",
  people: "/people",
  settings: "/settings",
  shared: "/shared",
  timeline: "/timeline"
};

const returnTargetLabels: Record<ReturnTarget, string> = {
  accounts: "Accounts",
  calendar: "Calendar",
  groups: "Groups",
  import: "Import",
  insights: "Insights",
  people: "People",
  settings: "Settings",
  shared: "Shared",
  timeline: "Timeline"
};

export const getSingleParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const isReturnTarget = (value: unknown): value is ReturnTarget =>
  typeof value === "string" && value in returnTargetRoutes;

export const getReturnTargetParam = (value: string | string[] | undefined) => {
  const singleValue = getSingleParam(value);
  return isReturnTarget(singleValue) ? singleValue : undefined;
};

export const getReturnTargetRoute = (value: string | string[] | undefined) => {
  const target = getReturnTargetParam(value);
  return target ? returnTargetRoutes[target] : null;
};

export const getReturnTargetLabel = (target: ReturnTarget | undefined) =>
  target ? returnTargetLabels[target] : null;

export const getReturnTargetForPathname = (pathname: string): ReturnTarget => {
  if (pathname.startsWith("/timeline")) {
    return "timeline";
  }

  if (pathname.startsWith("/shared")) {
    return "shared";
  }

  if (pathname.startsWith("/insights")) {
    return "insights";
  }

  if (pathname.startsWith("/settings")) {
    return "settings";
  }

  if (pathname.startsWith("/accounts")) {
    return "accounts";
  }

  if (pathname.startsWith("/groups")) {
    return "groups";
  }

  if (pathname.startsWith("/people")) {
    return "people";
  }

  if (pathname.startsWith("/import")) {
    return "import";
  }

  return "calendar";
};

export const withReturnTo = (route: string, target: ReturnTarget | undefined | null) => {
  if (!target) {
    return route as Href;
  }

  const separator = route.includes("?") ? "&" : "?";
  return `${route}${separator}returnTo=${target}` as Href;
};
