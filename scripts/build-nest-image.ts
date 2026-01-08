
import { execSync } from 'node:child_process';

// --- Configuration ---
const APP_NAME = 'kingstack-nest';
const DOCKER_FILE_PATH = 'apps/nest/Dockerfile';
const REGISTRY_NAME = process.env.DO_REGISTRY_NAME || 'pinkerton-digital';

// ANSI Colors
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    gray: '\x1b[90m',
};

function log(msg: string, color: keyof typeof colors = 'reset') {
    console.log(`${colors[color]}${msg}${colors.reset}`);
}

function error(msg: string): never {
    console.error(`${colors.red}Error: ${msg}${colors.reset}`);
    process.exit(1);
}

function run(command: string, options: { silent?: boolean; capture?: boolean } = {}) {
    log(`> ${command}`, 'gray');
    try {
        const output = execSync(command, {
            stdio: options.capture ? 'pipe' : 'inherit',
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
        });
        return output?.trim();
    } catch (e: any) {
        if (!options.silent) {
            error(`Command failed: ${command}\n${e.message}`);
        }
        throw e;
    }
}

async function main() {
    log(`🏗️  Building ${APP_NAME} image...`, 'green');

    // 1. Prerequisites Check
    log('\n🔍 Checking prerequisites...', 'blue');
    try {
        run('doctl version', { silent: true, capture: true });
        run('docker --version', { silent: true, capture: true });
    } catch (e) {
        error('Missing required tools. Please ensure `doctl` and `docker` are installed.');
    }

    try {
        run('doctl account get', { silent: true, capture: true });
    } catch (e) {
        error('Not authenticated with DigitalOcean. Please run `doctl auth init`.');
    }

    // 2. Get Registry Info
    log('\n📦 Checking Container Registry...', 'blue');
    let registryEndpoint = '';
    try {
        run(`doctl registry get ${REGISTRY_NAME} --output json`, { capture: true });
        registryEndpoint = `registry.digitalocean.com/${REGISTRY_NAME}`;
        log(`Using registry: ${registryEndpoint}`, 'green');
    } catch (e) {
        log(`Registry '${REGISTRY_NAME}' not found. Attempting to create it...`, 'yellow');
        try {
            run(`doctl registry create ${REGISTRY_NAME}`);
            registryEndpoint = `registry.digitalocean.com/${REGISTRY_NAME}`;
            log(`Created registry: ${registryEndpoint}`, 'green');
        } catch (createError) {
            error(`Failed to find or create registry '${REGISTRY_NAME}'.`);
        }
    }

    const fullImageTag = `${registryEndpoint}/${APP_NAME}:latest`;

    // 3. Login to Registry
    log('\n🔑 Logging in to registry...', 'blue');
    run(`doctl registry login`);

    // 4. Build Docker Image
    log('\n🏗️  Building Docker image...', 'blue');
    run(`docker build -f ${DOCKER_FILE_PATH} -t ${fullImageTag} .`);

    // 5. Compare digests to determine if push is needed
    log('\n🔍 Checking if push is needed...', 'blue');

    // Get local image digest
    let localDigest = '';
    try {
        localDigest = run(`docker inspect --format='{{.Id}}' ${fullImageTag}`, { capture: true }) || '';
    } catch (e) {
        error('Failed to get local image digest.');
    }

    // Get remote image digest
    let remoteDigest = '';
    try {
        // Try to get the remote manifest digest
        const manifestOutput = run(
            `doctl registry repository list-manifests ${APP_NAME} --output json`,
            { capture: true, silent: true }
        );
        const manifests = JSON.parse(manifestOutput || '[]');
        const latestManifest = manifests.find((m: any) => m.tags?.includes('latest'));
        remoteDigest = latestManifest?.digest || '';
    } catch (e) {
        log('No remote image found (first push).', 'yellow');
    }

    // Note: Local digest (sha256:...) and remote manifest digest differ in format.
    // For a proper comparison, we'd need to push and compare, or use content-trust.
    // Simpler approach: always push but clean up old images first.

    // 6. Clean up old images in registry before push
    log('\n🧹 Cleaning up old images from registry...', 'blue');
    try {
        const manifestOutput = run(
            `doctl registry repository list-manifests ${APP_NAME} --output json`,
            { capture: true, silent: true }
        );
        const manifests = JSON.parse(manifestOutput || '[]');

        for (const manifest of manifests) {
            if (manifest.digest) {
                log(`Deleting old manifest: ${manifest.digest.substring(0, 20)}...`, 'gray');
                run(`doctl registry repository delete-manifest ${APP_NAME} ${manifest.digest} --force`, { silent: true });
            }
        }

        // Run garbage collection to free space
        log('Running garbage collection...', 'gray');
        run(`doctl registry garbage-collection start ${REGISTRY_NAME} --force`, { silent: true });
    } catch (e) {
        log('No old images to clean up or cleanup failed (continuing...)', 'yellow');
    }

    // 7. Push to Registry
    log('\n☁️  Pushing image to registry...', 'blue');
    run(`docker push ${fullImageTag}`);

    log('\n✨ Build and push complete!', 'green');
    log(`Image: ${fullImageTag}`, 'green');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
