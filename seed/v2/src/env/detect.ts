/**
 * Environment Detection
 * Detects OS, platform, environment type, and system capabilities
 */

export interface Environment {
  // System info
  os: OS;
  arch: Architecture;
  platform: NodeJS.Platform;

  // Environment type
  type: EnvironmentType;

  // Capabilities
  hasSudo: boolean;
  isRoot: boolean;
  hasDocker: boolean;

  // Paths
  homeDir: string;
  cacheDir: string;
  configDir: string;
  binDir: string;

  // CI/CD detection
  ci: CIProvider | null;

  // Codespaces detection
  isCodespaces: boolean;

  // Container detection
  isContainer: boolean;
  containerType?: "docker" | "podman" | "kubernetes" | "unknown";

  // VPS detection
  isVPS: boolean;
  vpsProvider?: VPSProvider;
}

export type OS = "macos" | "linux" | "windows";
export type Architecture = "x64" | "arm64" | "aarch64";
export type EnvironmentType =
  | "vps"
  | "codespaces"
  | "ci"
  | "local"
  | "container";
export type CIProvider =
  | "github"
  | "gitlab"
  | "circleci"
  | "travis"
  | "jenkins"
  | "azure";
export type VPSProvider = "hetzner" | "aws" | "gcp" | "azure" | "digitalocean" | "linode" | "vultr" | "unknown";

/**
 * Detect the current environment
 */
export async function detectEnvironment(): Promise<Environment> {
  const os = detectOS();
  const arch = detectArch();
  const platform = process.platform;
  const type = detectEnvironmentType();
  const isRoot = process.getuid?.() === 0 || process.env.USER === "root";
  const hasSudo = await checkSudo();
  const hasDocker = await checkDocker();
  const ci = detectCI();
  const isCodespaces = detectCodespaces();
  const isContainer = await detectContainer();
  const containerType = isContainer ? await detectContainerType() : undefined;
  const isVPS = await detectVPS();
  const vpsProvider = isVPS ? await detectVPSProvider() : undefined;

  // Standard directories
  const homeDir =
    process.env.HOME ||
    process.env.USERPROFILE ||
    (process.platform === "win32"
      ? process.env.USERPROFILE || ""
      : `/home/${process.env.USER || "root"}`);

  const configDir =
    process.env.XDG_CONFIG_HOME ||
    `${homeDir}/.config`;
  const cacheDir =
    process.env.XDG_CACHE_HOME ||
    `${homeDir}/.cache`;

  // Bin directory depends on OS and permissions
  let binDir: string;
  if (os === "macos") {
    binDir = "/usr/local/bin";
  } else if (isRoot) {
    binDir = "/usr/local/bin";
  } else {
    binDir = `${homeDir}/.local/bin`;
  }

  return {
    os,
    arch,
    platform,
    type,
    hasSudo,
    isRoot,
    hasDocker,
    homeDir,
    cacheDir,
    configDir,
    binDir,
    ci,
    isCodespaces,
    isContainer,
    containerType,
    isVPS,
    vpsProvider,
  };
}

// ============================================================================
// Detection Functions
// ============================================================================

function detectOS(): OS {
  const platform = process.platform;
  switch (platform) {
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    case "win32":
      return "windows";
    default:
      throw new Error(`Unsupported OS: ${platform}`);
  }
}

function detectArch(): Architecture {
  const arch = process.arch;
  switch (arch) {
    case "x64":
    case "ia32":
      return "x64";
    case "arm64":
    case "aarch64":
      return "arm64";
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }
}

function detectEnvironmentType(): EnvironmentType {
  // Check for Codespaces first (GitHub cloud dev environment)
  if (process.env.CODESPACES === "true") {
    return "codespaces";
  }

  // Check for CI environment
  if (process.env.CI === "true") {
    return "ci";
  }

  // Check if we're in a container (without the async container detection)
  if (
    process.env.container ||
    process.env.KUBERNETES_SERVICE_HOST ||
    process.env.DOCKER_CONTAINER
  ) {
    return "container";
  }

  // Check VPS indicators (cloud metadata services)
  if (
    process.env.HETZNER_IP ||
    process.env.AWS_REGION ||
    process.env.GCP_REGION ||
    process.env.AZURE_REGION
  ) {
    return "vps";
  }

  // Default to local for desktop development
  // (we'll do async detection later for more accuracy)
  return "local";
}

async function checkSudo(): Promise<boolean> {
  try {
    const result = await Bun.spawn(["sudo", "-n", "true"], {
      stdout: "pipe",
      stderr: "pipe",
    }).exited;
    return result === 0;
  } catch {
    return false;
  }
}

async function checkDocker(): Promise<boolean> {
  try {
    const result = await Bun.spawn(["docker", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    }).exited;
    return result === 0;
  } catch {
    return false;
  }
}

function detectCI(): CIProvider | null {
  if (!process.env.CI) return null;

  if (process.env.GITHUB_ACTIONS) return "github";
  if (process.env.GITLAB_CI) return "gitlab";
  if (process.env.CIRCLECI) return "circleci";
  if (process.env.TRAVIS) return "travis";
  if (process.env.JENKINS_URL) return "jenkins";
  if (process.env.TF_BUILD) return "azure";

  return null;
}

function detectCodespaces(): boolean {
  return process.env.CODESPACES === "true" || process.env.CODESPACES === "1";
}

async function detectContainer(): Promise<boolean> {
  // Check for container indicators
  if (process.env.container === "docker") return true;
  if (process.env.KUBERNETES_SERVICE_HOST) return true;

  // Check for .dockerenv file
  try {
    const proc = Bun.spawn(["test", "-f", "/.dockerenv"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode === 0) return true;
  } catch {}

  // Check for docker in cgroup
  try {
    const proc = Bun.spawn([
      "grep",
      "-q",
      "docker",
      "/proc/1/cgroup",
    ], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode === 0) return true;
  } catch {}

  return false;
}

async function detectContainerType(): Promise<
  "docker" | "podman" | "kubernetes" | "unknown"
> {
  if (process.env.KUBERNETES_SERVICE_HOST) return "kubernetes";

  try {
    // Check for podman
    const proc = Bun.spawn(["which", "podman"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode === 0) return "podman";
  } catch {}

  return "docker"; // Default to docker for containers
}

async function detectVPS(): Promise<boolean> {
  // Check for cloud-specific environment variables or metadata services
  const indicators = [
    "HETZNER_IP",
    "HETZNER",
    "AWS_REGION",
    "AWS_DEFAULT_REGION",
    "GCP_REGION",
    "GOOGLE_CLOUD_PROJECT",
    "AZURE_REGION",
    "AZURE_LOCATION",
    "DIGITALOCEAN_DROPLET_ID",
    "LINODE_ID",
    "VULTR_INSTANCE_ID",
  ];

  for (const indicator of indicators) {
    if (process.env[indicator]) return true;
  }

  // Try to detect by checking for common cloud metadata services
  // (this is async but we'll do a simple check)

  return false;
}

async function detectVPSProvider(): Promise<VPSProvider> {
  if (process.env.HETZNER_IP || process.env.HETZNER) return "hetzner";
  if (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION) return "aws";
  if (process.env.GCP_REGION || process.env.GOOGLE_CLOUD_PROJECT) return "gcp";
  if (process.env.AZURE_REGION || process.env.AZURE_LOCATION) return "azure";
  if (process.env.DIGITALOCEAN_DROPLET_ID) return "digitalocean";
  if (process.env.LINODE_ID) return "linode";
  if (process.env.VULTR_INSTANCE_ID) return "vultr";

  return "unknown";
}
