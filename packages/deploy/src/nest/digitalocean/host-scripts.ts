import { isIP } from "node:net";
import { parsePort, sanitizeSlug, validateDomain } from "./options.js";

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function renderCaddyFragment(domain: string, port: number): string {
  const host = validateDomain(domain);
  const publicIpTls = isIP(host)
    ? `    tls {
        issuer acme https://acme-v02.api.letsencrypt.org/directory {
            profile shortlived
        }
    }
`
    : "";
  return `${host} {\n${publicIpTls}    reverse_proxy 127.0.0.1:${parsePort(port)}\n}\n`;
}

export function renderTrustedHttpsProbe(hostValue: string): string {
  const host = validateDomain(hostValue);
  if (isIP(host) === 0) {
    throw new Error(`Trusted IP HTTPS probe requires an IP address: ${host}`);
  }
  const url = shellQuote(`https://${host}/`);
  return `for attempt in $(seq 1 30); do
  if curl --fail --silent --max-time 2 ${url} >/dev/null; then
    exit 0
  fi
  sleep 2
done
echo 'Timed out waiting for a publicly trusted IP certificate.' >&2
exit 1`;
}

export function renderCloudInit(appSlug: string): string {
  const bootstrap = renderBootstrapScript(appSlug)
    .trimEnd()
    .split("\n")
    .map((line) => `      ${line}`)
    .join("\n");

  return `#cloud-config
ssh_pwauth: false
disable_root: false
package_update: true
packages:
  - ca-certificates
  - curl
  - debian-keyring
  - debian-archive-keyring
  - gpg
  - apt-transport-https
write_files:
  - path: /usr/local/sbin/kingstack-bootstrap
    permissions: "0755"
    content: |
${bootstrap}
runcmd:
  - [bash, /usr/local/sbin/kingstack-bootstrap]
`;
}

export function renderBootstrapScript(appSlug: string): string {
  const appDir = `/opt/kingstack/${sanitizeSlug(appSlug)}`;
  return `#!/usr/bin/env bash
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gpg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
printf '%s\\n' \\
  'Types: deb' \\
  'URIs: https://download.docker.com/linux/ubuntu' \\
  "Suites: \${UBUNTU_CODENAME:-$VERSION_CODENAME}" \\
  'Components: stable' \\
  "Architectures: $(dpkg --print-architecture)" \\
  'Signed-By: /etc/apt/keyrings/docker.asc' \\
  > /etc/apt/sources.list.d/docker.sources
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key -o /tmp/caddy.gpg
gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg /tmp/caddy.gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
chmod o+r /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin caddy
install -d -m 0755 /etc/caddy/conf.d
install -d -m 0700 ${appDir}
systemctl enable --now docker
systemctl enable --now caddy
`;
}

export function renderCaddyInstallScript(): string {
  return `#!/usr/bin/env bash
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl debian-keyring debian-archive-keyring gpg apt-transport-https
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key -o /tmp/caddy.gpg
gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg /tmp/caddy.gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
chmod o+r /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y
apt-get install -y caddy
install -d -m 0755 /etc/caddy/conf.d
systemctl enable --now caddy
`;
}

export function renderRemoteDeployScript(options: {
  appSlug: string;
  imageReference: string;
  revision: string;
  port: number;
  domain?: string;
  preservePortBinding?: boolean;
}): string {
  const appSlug = sanitizeSlug(options.appSlug);
  const port = parsePort(options.port);
  const current = `${appSlug}-nest`;
  const candidate = `${current}-candidate`;
  const previous = `${current}-previous`;
  const appDir = `/opt/kingstack/${appSlug}`;
  const configuredPublish = options.domain
    ? `127.0.0.1:${port}:${port}`
    : `0.0.0.0:${port}:${port}`;
  const publishSetup = options.preservePortBinding
    ? `${renderExistingDeploymentProbe(appSlug, port)}
publish="$publish:${port}"`
    : `publish=${shellQuote(configuredPublish)}`;
  const probe = shellQuote(
    `const http=require("node:http");const port=Number(process.env.PORT||${port});const request=http.get({host:"127.0.0.1",port,path:"/"},response=>{response.resume();process.exit(0)});request.setTimeout(1000,()=>{request.destroy();process.exit(1)});request.on("error",()=>process.exit(1));`,
  );

  return `#!/usr/bin/env bash
set -euo pipefail
app_dir=${shellQuote(appDir)}
current=${shellQuote(current)}
candidate=${shellQuote(candidate)}
previous=${shellQuote(previous)}
image=${shellQuote(options.imageReference)}
revision=${shellQuote(options.revision)}
staged_env=${shellQuote(`/tmp/${appSlug}.env.next`)}
active_env="$app_dir/.env"
${publishSetup}

wait_ready() {
  local container="$1"
  for _attempt in $(seq 1 30); do
    if ! docker inspect "$container" >/dev/null 2>&1; then
      return 1
    fi
    if [ "$(docker inspect --format '{{.State.Running}}' "$container")" != "true" ]; then
      return 1
    fi
    if docker exec "$container" node -e ${probe}; then
      return 0
    fi
    sleep 2
  done
  return 1
}

restore_previous() {
  docker rm -f "$current" >/dev/null 2>&1 || true
  if docker inspect "$previous" >/dev/null 2>&1; then
    docker rename "$previous" "$current"
    docker start "$current" >/dev/null
  fi
}

install -d -m 0700 "$app_dir"
install -m 0600 "$staged_env" "$active_env"
rm -f "$staged_env"
docker rm -f "$candidate" >/dev/null 2>&1 || true

docker run -d --restart=no \
  --name "$candidate" \
  --env-file "$active_env" \
  --label com.kingstack.app=${shellQuote(appSlug)} \
  --label com.kingstack.revision="$revision" \
  "$image" >/dev/null

if ! wait_ready "$candidate"; then
  docker logs "$candidate" --tail 100 >&2 || true
  docker rm -f "$candidate" >/dev/null 2>&1 || true
  exit 1
fi

old_previous_image=""
if docker inspect "$previous" >/dev/null 2>&1; then
  old_previous_image="$(docker inspect --format '{{.Image}}' "$previous")"
  docker rm -f "$previous" >/dev/null
fi

if docker inspect "$current" >/dev/null 2>&1; then
  docker stop "$current" >/dev/null || true
  docker rename "$current" "$previous"
fi

docker rm -f "$candidate" >/dev/null
if ! docker run -d --restart=unless-stopped \
  --name "$current" \
  --env-file "$active_env" \
  --label com.kingstack.app=${shellQuote(appSlug)} \
  --label com.kingstack.revision="$revision" \
  -p "$publish" \
  "$image" >/dev/null; then
  restore_previous
  exit 1
fi

if ! wait_ready "$current"; then
  docker logs "$current" --tail 100 >&2 || true
  restore_previous
  exit 1
fi

if [ -n "$old_previous_image" ]; then
  docker image rm "$old_previous_image" >/dev/null 2>&1 || true
fi
`;
}

export function renderExistingDeploymentProbe(
  appSlugValue: string,
  portValue: number,
): string {
  const current = `${sanitizeSlug(appSlugValue)}-nest`;
  const port = parsePort(portValue);
  return `current=${shellQuote(current)}
if ! docker inspect "$current" >/dev/null 2>&1; then
  echo "Application-only deployment requires an existing $current container. Use host reconfiguration for a first deployment." >&2
  exit 1
fi
publish="$(docker inspect --format '{{with (index .HostConfig.PortBindings "${port}/tcp")}}{{with (index . 0)}}{{if .HostIp}}{{.HostIp}}{{else}}0.0.0.0{{end}}:{{.HostPort}}{{end}}{{end}}' "$current")"
if [ -z "$publish" ]; then
  echo "Could not determine the existing ${port}/tcp port binding for $current; refusing to change its routing." >&2
  exit 1
fi`;
}

export function renderRemoteRollbackScript(appSlugValue: string): string {
  const appSlug = sanitizeSlug(appSlugValue);
  const current = `${appSlug}-nest`;
  const previous = `${current}-previous`;
  return `#!/usr/bin/env bash
set -euo pipefail
current=${shellQuote(current)}
previous=${shellQuote(previous)}
if ! docker inspect "$previous" >/dev/null 2>&1; then
  echo "No previous container is available for $current" >&2
  exit 1
fi
failed_image=""
if docker inspect "$current" >/dev/null 2>&1; then
  failed_image="$(docker inspect --format '{{.Image}}' "$current")"
  docker rm -f "$current" >/dev/null
fi
docker rename "$previous" "$current"
docker start "$current" >/dev/null
if [ -n "$failed_image" ]; then
  docker image rm "$failed_image" >/dev/null 2>&1 || true
fi
`;
}

export function renderCaddyApplyScript(
  appSlugValue: string,
  fragmentContents: string,
): string {
  const appSlug = sanitizeSlug(appSlugValue);
  const fragment = `/etc/caddy/conf.d/${appSlug}.caddy`;
  const previous = `${fragment}.previous`;
  const previousMissing = `${previous}.missing`;
  const encoded = Buffer.from(fragmentContents, "utf8").toString("base64");

  return `#!/usr/bin/env bash
set -euo pipefail
root=/etc/caddy/Caddyfile
fragment=${shellQuote(fragment)}
previous=${shellQuote(previous)}
previous_missing=${shellQuote(previousMissing)}
root_candidate=/tmp/kingstack.Caddyfile
root_previous=/tmp/kingstack.Caddyfile.previous
fragment_candidate=/tmp/kingstack.fragment.caddy

install -d -m 0755 /etc/caddy/conf.d
touch "$root"
cp "$root" "$root_previous"
cp "$root" "$root_candidate"
if ! grep -Fqx 'import /etc/caddy/conf.d/*.caddy' "$root_candidate"; then
  printf '\nimport /etc/caddy/conf.d/*.caddy\n' >> "$root_candidate"
fi

rm -f "$previous" "$previous_missing"
if [ -f "$fragment" ]; then
  cp "$fragment" "$previous"
else
  touch "$previous_missing"
fi
printf %s ${shellQuote(encoded)} | base64 -d > "$fragment_candidate"
install -m 0644 "$fragment_candidate" "$fragment"

restore_files() {
  cp "$root_previous" "$root"
  if [ -f "$previous" ]; then
    cp "$previous" "$fragment"
  else
    rm -f "$fragment"
  fi
}

if ! caddy validate --adapter caddyfile --config "$root_candidate"; then
  restore_files
  exit 1
fi
install -m 0644 "$root_candidate" "$root"
if ! caddy reload --adapter caddyfile --config "$root"; then
  restore_files
  caddy reload --adapter caddyfile --config "$root" || true
  exit 1
fi
`;
}

export function renderCaddyRollbackScript(appSlugValue: string): string {
  const appSlug = sanitizeSlug(appSlugValue);
  const fragment = `/etc/caddy/conf.d/${appSlug}.caddy`;
  const previous = `${fragment}.previous`;
  const previousMissing = `${previous}.missing`;
  return `#!/usr/bin/env bash
set -euo pipefail
fragment=${shellQuote(fragment)}
previous=${shellQuote(previous)}
previous_missing=${shellQuote(previousMissing)}
if [ -f "$previous" ]; then
  cp "$previous" "$fragment"
elif [ -f "$previous_missing" ]; then
  printf '# No managed domain for ${appSlug}\n' > "$fragment"
else
  exit 0
fi
caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile
caddy reload --adapter caddyfile --config /etc/caddy/Caddyfile
`;
}
