import dns from "node:dns/promises";
import net from "node:net";

const isPrivateIPv4 = (ip: string): boolean => {
  const parts = ip.split(".").map(Number);

  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [a, b, c, d] = parts;

  // 0.0.0.0/8
  if (a === 0) return true;

  // 10.0.0.0/8
  if (a === 10) return true;

  // 100.64.0.0/10 - Shared address space
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }

  // 127.0.0.0/8 - Loopback
  if (a === 127) return true;

  // 169.254.0.0/16 - Link local
  if (a === 169 && b === 254) {
    return true;
  }

  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  // 192.0.0.0/24 - IETF protocol assignments
  if (a === 192 && b === 0 && c === 0) {
    return true;
  }

  // 192.0.2.0/24 - Documentation
  if (a === 192 && b === 0 && c === 2) {
    return true;
  }

  // 192.168.0.0/16
  if (a === 192 && b === 168) {
    return true;
  }

  // 198.18.0.0/15 - Benchmarking
  if (a === 198 && (b === 18 || b === 19)) {
    return true;
  }

  // 198.51.100.0/24 - Documentation
  if (a === 198 && b === 51 && c === 100) {
    return true;
  }

  // 203.0.113.0/24 - Documentation
  if (a === 203 && b === 0 && c === 113) {
    return true;
  }

  // 224.0.0.0/4 - Multicast
  if (a >= 224 && a <= 239) {
    return true;
  }

  // 240.0.0.0/4 - Reserved
  if (a >= 240) {
    return true;
  }

  void d;

  return false;
};

const isPrivateIPv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase();

  // IPv6 loopback
  if (normalized === "::1") {
    return true;
  }

  // Unspecified
  if (normalized === "::") {
    return true;
  }

  // IPv4-mapped IPv6
  if (normalized.startsWith("::ffff:")) {
    const mappedIPv4 = normalized.substring("::ffff:".length);

    if (net.isIP(mappedIPv4) === 4) {
      return isPrivateIPv4(mappedIPv4);
    }
  }

  // Unique local address fc00::/7
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }

  // Link-local fe80::/10
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }

  // Multicast ff00::/8
  if (normalized.startsWith("ff")) {
    return true;
  }

  // Documentation 2001:db8::/32
  if (normalized.startsWith("2001:db8:")) {
    return true;
  }

  return false;
};

const isBlockedIp = (ip: string): boolean => {
  const family = net.isIP(ip);

  if (family === 4) {
    return isPrivateIPv4(ip);
  }

  if (family === 6) {
    return isPrivateIPv6(ip);
  }

  return true;
};

export const validateExternalUrl = async (input: string): Promise<URL> => {
  if (!input || typeof input !== "string") {
    throw new Error("Company URL is required");
  }

  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Invalid company URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are allowed");
  }

  // Credentials in URLs are unnecessary for this application.
  if (url.username || url.password) {
    throw new Error("URLs containing credentials are not allowed");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");

  if (!hostname) {
    throw new Error("Company URL hostname is required");
  }

  // Local/internal hostnames
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".home") ||
    hostname.endsWith(".lan")
  ) {
    throw new Error("Private/local URLs are not allowed");
  }

  // Direct IP address
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new Error("Private or reserved IP addresses are not allowed");
    }

    return url;
  }

  let addresses: Array<{ address: string; family: number }>;

  try {
    addresses = await dns.lookup(hostname, {
      all: true,
      verbatim: true,
    });
  } catch {
    throw new Error(`Unable to resolve company hostname: ${hostname}`);
  }

  if (addresses.length === 0) {
    throw new Error(`Unable to resolve company hostname: ${hostname}`);
  }

  for (const address of addresses) {
    if (isBlockedIp(address.address)) {
      throw new Error("URL resolves to a private or reserved IP address");
    }
  }

  return url;
};
