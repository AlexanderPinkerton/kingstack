
import { execSync } from 'node:child_process';

// --- Configuration ---
const APP_NAME = 'kingstack-nest';
const REGISTRY_NAME = process.env.DO_REGISTRY_NAME || 'pinkerton-digital';
const DROPLET_TAG = process.env.DO_DROPLET_TAG || 'kingstack-nest';

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
    log(`🚀 Deploying ${APP_NAME} to Droplets...`, 'green');

    // 1. Prerequisites Check
    log('\n🔍 Checking prerequisites...', 'blue');
    try {
        run('doctl version', { silent: true, capture: true });
    } catch (e) {
        error('Missing doctl. Please install it: brew install doctl');
    }

    try {
        run('doctl account get', { silent: true, capture: true });
    } catch (e) {
        error('Not authenticated with DigitalOcean. Please run `doctl auth init`.');
    }

    const registryEndpoint = `registry.digitalocean.com/${REGISTRY_NAME}`;
    const fullImageTag = `${registryEndpoint}/${APP_NAME}:latest`;

    // 2. Find target Droplets
    log('\n🌩️  Finding target Droplets...', 'blue');

    const dropletsJson = run(`doctl compute droplet list --tag-name ${DROPLET_TAG} --output json`, { capture: true });
    let droplets = JSON.parse(dropletsJson || '[]');

    if (droplets.length === 0) {
        log(`No droplets found with tag '${DROPLET_TAG}'. Checking by name...`, 'yellow');

        const allDropletsJson = run(`doctl compute droplet list --output json`, { capture: true });
        const allDroplets = JSON.parse(allDropletsJson || '[]');

        const matchingDroplet = allDroplets.find((d: any) => d.name === DROPLET_TAG || d.name === APP_NAME);

        if (matchingDroplet) {
            log(`Found droplet '${matchingDroplet.name}'! Adding tag '${DROPLET_TAG}'...`, 'green');
            run(`doctl compute droplet tag ${matchingDroplet.id} --tag-name ${DROPLET_TAG}`);
            droplets = [matchingDroplet];
        } else {
            error(`No droplets found. Create one with: doctl compute droplet create ${DROPLET_TAG} --image docker-20-04 --size s-1vcpu-1gb --region nyc3`);
        }
    }

    // 3. Get Auth Token for Remote Login
    const doToken = run('doctl auth token', { capture: true });

    // 4. Deploy to each Droplet
    for (const droplet of droplets) {
        const ip = droplet.networks.v4.find((n: any) => n.type === 'public')?.ip_address;
        if (!ip) {
            log(`Skipping droplet ${droplet.name} (no public IP)`, 'yellow');
            continue;
        }

        log(`\n🚀 Deploying to ${droplet.name} (${ip})...`, 'blue');

        const remoteCommands = [
            // Login to registry
            `echo "${doToken}" | docker login registry.digitalocean.com -u ${doToken} --password-stdin`,

            // Pull latest image
            `docker pull ${fullImageTag}`,

            // Stop & remove old container
            `docker stop ${APP_NAME} || true`,
            `docker rm ${APP_NAME} || true`,

            // Start new container
            `docker run -d --restart unless-stopped --name ${APP_NAME} -p 3000:3000 ${fullImageTag}`,

            // Cleanup unused images
            `docker system prune -af`,
        ];

        const sshCommand = `ssh -o StrictHostKeyChecking=no root@${ip} '${remoteCommands.join(' && ')}'`;

        try {
            run(sshCommand);
            log(`✅ Successfully deployed to ${droplet.name}`, 'green');
        } catch (e) {
            log(`❌ Failed to deploy to ${droplet.name}`, 'red');
        }
    }

    log('\n✨ Deployment complete!', 'green');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
