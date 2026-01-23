/**
 * Package Manager Installation
 * Handles Homebrew, apt, yum, and other package managers
 */

import type { Environment, OS } from "./detect";

export interface PackageManager {
  name: string;
  install: (packages: string[]) => Promise<void>;
  update: () => Promise<void>;
  installed: () => Promise<boolean>;
}

export interface SetupOptions {
  force?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
}

/**
 * Install the appropriate package manager for the OS
 */
export async function installPackages(
  env: Environment,
  options: SetupOptions = {}
): Promise<PackageManager | null> {
  const { os, hasSudo, isRoot } = env;

  // Check if we can install packages
  if (!isRoot && !hasSudo && os === "linux") {
    console.warn("⚠ No sudo access, skipping package manager installation");
    return null;
  }

  switch (os) {
    case "macos":
      return await installHomebrew(env, options);
    case "linux":
      return await detectAndInstallLinuxPackageManager(env, options);
    case "windows":
      console.warn("⚠ Windows not fully supported yet");
      return null;
    default:
      throw new Error(`Unsupported OS: ${os}`);
  }
}

// ============================================================================
// Homebrew (macOS)
// ============================================================================

async function installHomebrew(
  env: Environment,
  options: SetupOptions
): Promise<PackageManager> {
  // Check if Homebrew is already installed
  if (await isHomebrewInstalled()) {
    console.log("✓ Homebrew already installed");
    return createHomebrewManager();
  }

  console.log("Installing Homebrew...");

  if (options.dryRun) {
    console.log("[dry-run] Would install Homebrew");
    return createHomebrewManager();
  }

  // Download and run Homebrew installer
  const installCmd = `
    set -e
    NONINTERACTIVE=1
    bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  `;

  const proc = Bun.spawn(["bash", "-c", installCmd], {
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, NONINTERACTIVE: "1" },
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error("Homebrew installation failed");
  }

  console.log("✓ Homebrew installed");

  // Add to PATH for current session
  const homebrewPaths = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/home/linuxbrew/.linuxbrew/bin",
  ];

  for (const path of homebrewPaths) {
    if (!process.env.PATH?.includes(path)) {
      process.env.PATH = `${path}:${process.env.PATH || ""}`;
    }
  }

  return createHomebrewManager();
}

async function isHomebrewInstalled(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["brew", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

function createHomebrewManager(): PackageManager {
  return {
    name: "brew",
    async install(packages: string[]) {
      const cmd = ["brew", "install", ...packages];
      const proc = Bun.spawn(cmd, {
        stdout: "inherit",
        stderr: "inherit",
      });
      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        throw new Error(`Failed to install: ${packages.join(", ")}`);
      }
    },
    async update() {
      const proc = Bun.spawn(["brew", "update"], {
        stdout: "inherit",
        stderr: "inherit",
      });
      await proc.exited;
    },
    async installed() {
      return isHomebrewInstalled();
    },
  };
}

// ============================================================================
// Linux Package Managers (apt, yum, dnf, etc.)
// ============================================================================

async function detectAndInstallLinuxPackageManager(
  env: Environment,
  options: SetupOptions
): Promise<PackageManager> {
  // Try to detect existing package manager
  const managers = [
    { name: "apt", check: isAptAvailable, create: createAptManager },
    { name: "yum", check: isYumAvailable, create: createYumManager },
    { name: "dnf", check: isDnfAvailable, create: createDnfManager },
    { name: "pacman", check: isPacmanAvailable, create: createPacmanManager },
    { name: "zypper", check: isZypperAvailable, create: createZypperManager },
  ];

  for (const manager of managers) {
    if (await manager.check()) {
      console.log(`✓ Found ${manager.name}`);
      return manager.create();
    }
  }

  // No package manager found, this is unusual for Linux
  throw new Error("No supported package manager found");
}

async function isAptAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", "apt-get"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

function createAptManager(): PackageManager {
  return {
    name: "apt",
    async install(packages: string[]) {
      // Update first
      await this.update();

      const proc = Bun.spawn(
        [
          "sudo",
          "DEBIAN_FRONTEND=noninteractive",
          "apt-get",
          "install",
          "-y",
          ...packages,
        ],
        {
          stdout: "inherit",
          stderr: "inherit",
        }
      );
      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        throw new Error(`Failed to install: ${packages.join(", ")}`);
      }
    },
    async update() {
      const proc = Bun.spawn(
        ["sudo", "apt-get", "update", "-qq"],
        {
          stdout: "inherit",
          stderr: "inherit",
        }
      );
      await proc.exited;
    },
    async installed() {
      return isAptAvailable();
    },
  };
}

async function isYumAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", "yum"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

function createYumManager(): PackageManager {
  return {
    name: "yum",
    async install(packages: string[]) {
      const proc = Bun.spawn(
        ["sudo", "yum", "install", "-y", ...packages],
        {
          stdout: "inherit",
          stderr: "inherit",
        }
      );
      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        throw new Error(`Failed to install: ${packages.join(", ")}`);
      }
    },
    async update() {
      const proc = Bun.spawn(["sudo", "yum", "check-update", "-q"], {
        stdout: "inherit",
        stderr: "inherit",
      });
      await proc.exited;
    },
    async installed() {
      return isYumAvailable();
    },
  };
}

async function isDnfAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", "dnf"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

function createDnfManager(): PackageManager {
  return {
    name: "dnf",
    async install(packages: string[]) {
      const proc = Bun.spawn(
        ["sudo", "dnf", "install", "-y", ...packages],
        {
          stdout: "inherit",
          stderr: "inherit",
        }
      );
      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        throw new Error(`Failed to install: ${packages.join(", ")}`);
      }
    },
    async update() {
      const proc = Bun.spawn(["sudo", "dnf", "check-update", "-q"], {
        stdout: "inherit",
        stderr: "inherit",
      });
      await proc.exited;
    },
    async installed() {
      return isDnfAvailable();
    },
  };
}

async function isPacmanAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", "pacman"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

function createPacmanManager(): PackageManager {
  return {
    name: "pacman",
    async install(packages: string[]) {
      const proc = Bun.spawn(
        ["sudo", "pacman", "-S", "--noconfirm", ...packages],
        {
          stdout: "inherit",
          stderr: "inherit",
        }
      );
      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        throw new Error(`Failed to install: ${packages.join(", ")}`);
      }
    },
    async update() {
      const proc = Bun.spawn(["sudo", "pacman", "-Sy"], {
        stdout: "inherit",
        stderr: "inherit",
      });
      await proc.exited;
    },
    async installed() {
      return isPacmanAvailable();
    },
  };
}

async function isZypperAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", "zypper"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

function createZypperManager(): PackageManager {
  return {
    name: "zypper",
    async install(packages: string[]) {
      const proc = Bun.spawn(
        ["sudo", "zypper", "install", "-y", ...packages],
        {
          stdout: "inherit",
          stderr: "inherit",
        }
      );
      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        throw new Error(`Failed to install: ${packages.join(", ")}`);
      }
    },
    async update() {
      const proc = Bun.spawn(["sudo", "zypper", "refresh"], {
        stdout: "inherit",
        stderr: "inherit",
      });
      await proc.exited;
    },
    async installed() {
      return isZypperAvailable();
    },
  };
}
