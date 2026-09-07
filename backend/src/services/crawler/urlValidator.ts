import dns from "node:dns/promises";
import net from "node:net";

const isPrivateIPv4 = (ip: string): boolean => {
  const parts = ip.split(".").map(Number);

  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return false;
  }

  const [a, b] = parts;

  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
};

const isPrivateIPv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase();

  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80")
  );
};

export const validateExternalUrl = async (
  input: string
): Promise<URL> => {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new Error("Invalid company URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(
      "Only HTTP and HTTPS URLs are allowed"
    );
  }

  const hostname = url.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error(
      "Private/local URLs are not allowed"
    );
  }

  if (net.isIP(hostname)) {
    if (
      isPrivateIPv4(hostname) ||
      isPrivateIPv6(hostname)
    ) {
      throw new Error(
        "Private IP addresses are not allowed"
      );
    }

    return url;
  }

  try {
    const addresses = await dns.lookup(hostname, {
      all: true,
    });

    for (const address of addresses) {
      if (
        (address.family === 4 &&
          isPrivateIPv4(address.address)) ||
        (address.family === 6 &&
          isPrivateIPv6(address.address))
      ) {
        throw new Error(
          "URL resolves to a private IP address"
        );
      }
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("private IP")
    ) {
      throw error;
    }

    throw new Error(
      `Unable to resolve company hostname: ${hostname}`
    );
  }

  return url;
};