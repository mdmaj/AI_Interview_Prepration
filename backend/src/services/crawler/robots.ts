import axios from "axios";

const USER_AGENT = "AI-Interview-Prep-Kit";

interface RobotsRule {
  userAgents: string[];
  allow: string[];
  disallow: string[];
}

interface RobotsPolicy {
  rules: RobotsRule[];
}

interface CachedRobots {
  policy: RobotsPolicy;
  expiresAt: number;
}

const robotsCache = new Map<string, CachedRobots>();

const CACHE_TTL_MS = 10 * 60 * 1000;
const ROBOTS_TIMEOUT_MS = 5000;
const MAX_ROBOTS_SIZE = 512 * 1024;

const parseRobots = (content: string): RobotsPolicy => {
  const rules: RobotsRule[] = [];

  let currentUserAgents: string[] = [];
  let currentAllow: string[] = [];
  let currentDisallow: string[] = [];
  let hasRules = false;

  const saveCurrentGroup = (): void => {
    if (currentUserAgents.length === 0) {
      return;
    }

    rules.push({
      userAgents: [...currentUserAgents],
      allow: [...currentAllow],
      disallow: [...currentDisallow],
    });

    currentUserAgents = [];
    currentAllow = [];
    currentDisallow = [];
    hasRules = false;
  };

  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0].trim();

    if (!line) {
      saveCurrentGroup();
      continue;
    }

    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const directive = line.slice(0, separatorIndex).trim().toLowerCase();

    const value = line.slice(separatorIndex + 1).trim();

    if (directive === "user-agent") {
      // A new User-agent after rules means a new group.
      if (hasRules) {
        saveCurrentGroup();
      }

      if (value) {
        currentUserAgents.push(value.toLowerCase());
      }

      continue;
    }

    if (directive === "allow" && currentUserAgents.length > 0) {
      hasRules = true;

      if (value) {
        currentAllow.push(value);
      }

      continue;
    }

    if (directive === "disallow" && currentUserAgents.length > 0) {
      hasRules = true;

      // Empty Disallow means everything is allowed.
      if (value) {
        currentDisallow.push(value);
      }
    }
  }

  saveCurrentGroup();

  return {
    rules,
  };
};

const getApplicableRules = (policy: RobotsPolicy): RobotsRule[] => {
  const exactMatches = policy.rules.filter((rule) =>
    rule.userAgents.some((agent) => agent === USER_AGENT.toLowerCase()),
  );

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  return policy.rules.filter((rule) =>
    rule.userAgents.some((agent) => agent === "*"),
  );
};

const matchesPath = (pathname: string, rulePath: string): boolean => {
  if (!rulePath) {
    return false;
  }

  // Handle robots.txt wildcard.
  const wildcardIndex = rulePath.indexOf("*");

  if (wildcardIndex !== -1) {
    const beforeWildcard = rulePath
      .slice(0, wildcardIndex)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const afterWildcard = rulePath
      .slice(wildcardIndex + 1)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const regex = new RegExp(`^${beforeWildcard}.*${afterWildcard}`);

    return regex.test(pathname);
  }

  return pathname.startsWith(rulePath);
};

const isAllowedByRules = (pathname: string, rules: RobotsRule[]): boolean => {
  const allowPaths = rules.flatMap((rule) => rule.allow);

  const disallowPaths = rules.flatMap((rule) => rule.disallow);

  const matchingAllows = allowPaths.filter((path) =>
    matchesPath(pathname, path),
  );

  const matchingDisallows = disallowPaths.filter((path) =>
    matchesPath(pathname, path),
  );

  if (matchingAllows.length === 0 && matchingDisallows.length === 0) {
    return true;
  }

  const longestAllow = Math.max(
    0,
    ...matchingAllows.map((path) => path.length),
  );

  const longestDisallow = Math.max(
    0,
    ...matchingDisallows.map((path) => path.length),
  );

  // Longest matching rule wins.
  // If same length, Allow wins.
  return longestAllow >= longestDisallow;
};

const fetchRobots = async (robotsUrl: string): Promise<RobotsPolicy> => {
  const cached = robotsCache.get(robotsUrl);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.policy;
  }

  try {
    const response = await axios.get<string>(robotsUrl, {
      timeout: ROBOTS_TIMEOUT_MS,

      maxContentLength: MAX_ROBOTS_SIZE,

      maxBodyLength: MAX_ROBOTS_SIZE,

      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/plain",
      },

      validateStatus: (status) => status >= 200 && status < 400,
    });

    const content = typeof response.data === "string" ? response.data : "";

    const policy = parseRobots(content);

    robotsCache.set(robotsUrl, {
      policy,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return policy;
  } catch {
    // If robots.txt is unavailable,
    // don't block the entire research process.
    const emptyPolicy: RobotsPolicy = {
      rules: [],
    };

    robotsCache.set(robotsUrl, {
      policy: emptyPolicy,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return emptyPolicy;
  }
};

export const canCrawl = async (targetUrl: string): Promise<boolean> => {
  let url: URL;

  try {
    url = new URL(targetUrl);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return false;
  }

  const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;

  const policy = await fetchRobots(robotsUrl);

  const applicableRules = getApplicableRules(policy);

  // No applicable rules means allowed.
  if (applicableRules.length === 0) {
    return true;
  }

  return isAllowedByRules(url.pathname || "/", applicableRules);
};
