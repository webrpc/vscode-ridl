import { exec } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { cwd } from "process";
import { existsSync, mkdirSync, rmSync } from "fs";
import git from "simple-git";

const REPO_URL = "https://github.com/webrpc/ridlfmt.git";
const BINARY_NAME = "ridlfmt";
const BUILD_DIR = "bin";

const SUPPORTED_PLATFORMS = ["darwin", "linux", "windows"] as const;
const SUPPORTED_ARCHITECTURES = ["amd64", "arm64"] as const;

function execCommand(command: string, cwd?: string) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd }, (error, stdout, _stderr) => {
      if (error) {
        reject(error);
      }

      resolve(stdout);
    });
  });
}

async function buildGoBinaries(outDir: string, tempDir: string) {
  for (const platform of SUPPORTED_PLATFORMS) {
    for (const arch of SUPPORTED_ARCHITECTURES) {
      const binaryName = `${BINARY_NAME}-${platform}-${arch}`;
      const binaryPath = join(outDir, binaryName);

      console.log(`Building ${binaryName} in ${outDir}`);

      await execCommand(
        `GOOS=${platform} GOARCH=${arch} go build -o ${binaryPath}`,
        tempDir
      );
    }
  }
}

async function main() {
  const tempDir = join(tmpdir(), BINARY_NAME);
  const outDir = join(cwd(), BUILD_DIR);

  try {
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    // Clone the repository
    console.log(`Cloning repository ${REPO_URL} into ${tempDir}`);
    await git().clone(REPO_URL, tempDir);

    // Build the Go project
    console.log(`Building the Go project in ${outDir}`);

    // For now no external dependencies, so we can directly call the build command on the go project
    // In the future if the author decides to add dependencies, we can use the go mod command to install the dependencies
    await buildGoBinaries(outDir, tempDir);

    console.log("Build successful");
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    // Clean up the temporary directory
    console.log(`Removing temporary directory ${tempDir}`);
    rmSync(tempDir, { recursive: true, force: true });
    console.log("Temporary directory removed");
  }
}

main().catch(console.error);
