# VPS SSH allowlist for GitHub Actions (deploy workflow)

**Status:** DRAFT — for review, not yet applied.
**Problem this solves:** the production deploy workflow (`appleboy/ssh-action` → `host: 176.222.53.185:22`) fails with `dial tcp 176.222.53.185:22: i/o timeout` because the VPS firewall blocks direct port-22 access from the public internet. Operator SSH already works through the Cloudflare tunnel (`reclabs3`), so this only affects CI.

---

## TL;DR — three viable options

| Option                                                  | Effort | Security tradeoff                                      | Maintenance                             |
| ------------------------------------------------------- | ------ | ------------------------------------------------------ | --------------------------------------- |
| **A. Allowlist GH Actions IPs on the VPS** _(this doc)_ | Low    | Opens 22 to thousands of GH IPs; widens attack surface | Daily/weekly sync — GH IPs churn        |
| **B. SSH through the Cloudflare tunnel in CI**          | Medium | No change to VPS firewall; reuses existing tunnel auth | One-time setup; auth-rotate when needed |
| **C. Self-hosted runner inside the VPS**                | Medium | Runner has VPS-local network; no SSH from outside      | Patching + runner upgrades              |

**Recommendation:** Option B (Cloudflare Tunnel `cloudflared access ssh` in the runner) is the cleanest fit for the existing hardening posture. Option A (this doc) is the path of least resistance if you want CI deploys back today and accept the maintenance cost.

The rest of this document fully specifies Option A. Options B and C are sketched at the bottom.

---

## Option A — UFW allowlist for GitHub Actions IPs

### A.1 — Scope of the allowlist

GitHub publishes its runner IP ranges at `https://api.github.com/meta`. The relevant top-level key is `actions[]` — a list of CIDRs (currently ~3,000+ entries spanning IPv4 and IPv6 across Azure regions where hosted runners live). The list changes weekly. Stale entries cause silent CI failures; missing entries cause silent CI failures. **You need automated sync.**

### A.2 — One-time VPS prep

Run on the VPS as a user with sudo:

```bash
# Confirm UFW is the firewall in use (otherwise translate to iptables/nftables).
sudo ufw status verbose

# Backup current rules before touching anything.
sudo ufw status numbered | sudo tee /root/ufw.backup.$(date +%F).txt

# Make sure SSH is currently rejected from the public internet
# (sanity-check: it should be — that's why CI is failing).
sudo ss -ltnp | grep ':22'
```

### A.3 — Sync script (run on the VPS, scheduled)

Save as `/usr/local/bin/sync-gh-actions-allowlist.sh`:

```bash
#!/usr/bin/env bash
# Sync UFW allow rules for SSH (22/tcp) with GitHub Actions IP ranges.
# Runs idempotently: rules are tagged with a comment so we can find + replace them.

set -euo pipefail

TAG="gha-allow"
META_URL="https://api.github.com/meta"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

# 1. Pull the current GH Actions ranges (curl + jq).
curl -fsS "$META_URL" | jq -r '.actions[]' | sort -u > "$TMP/new.txt"

# Defensive: bail if the list looks empty/malformed.
wc -l < "$TMP/new.txt" | awk '{ if ($1 < 100) exit 1 }' || {
  echo "GH meta returned <100 CIDRs — refusing to apply" >&2
  exit 1
}

# 2. Read current UFW rules tagged with our TAG.
sudo ufw status | grep "# $TAG$" | awk '{ print $3 }' | sort -u > "$TMP/old.txt"

# 3. Compute additions and removals.
comm -23 "$TMP/new.txt" "$TMP/old.txt" > "$TMP/add.txt"
comm -13 "$TMP/new.txt" "$TMP/old.txt" > "$TMP/remove.txt"

# 4. Apply removals first (so we don't blow rule count limits if GH expanded).
while read -r cidr; do
  [ -z "$cidr" ] && continue
  sudo ufw delete allow from "$cidr" to any port 22 proto tcp || true
done < "$TMP/remove.txt"

# 5. Apply additions.
while read -r cidr; do
  [ -z "$cidr" ] && continue
  sudo ufw allow from "$cidr" to any port 22 proto tcp comment "$TAG"
done < "$TMP/add.txt"

echo "gha-allow sync: +$(wc -l < "$TMP/add.txt") -$(wc -l < "$TMP/remove.txt")"
```

Permissions:

```bash
sudo install -o root -g root -m 0755 sync-gh-actions-allowlist.sh /usr/local/bin/
```

### A.4 — Schedule the sync (cron)

```bash
sudo crontab -e
# Add — runs daily at 03:17 UTC and writes a rotating log.
17 3 * * * /usr/local/bin/sync-gh-actions-allowlist.sh >> /var/log/gha-allow.log 2>&1
```

Initial run:

```bash
sudo /usr/local/bin/sync-gh-actions-allowlist.sh
sudo ufw status verbose | grep -c "$TAG"   # expect a few thousand
```

### A.5 — Verify from CI

After the first sync completes, re-run the failed deploy:

```bash
gh run rerun 26505265999            # or the latest failing run
gh run watch
```

The SSH step should now connect. If it still times out:

- Verify `sudo ufw status numbered | grep gha-allow | wc -l` is non-zero.
- Tail `/var/log/auth.log` during the rerun and look for accepted/refused sessions.
- Confirm the runner's outbound IP is in the GH meta list at the time of the run (Azure region drift sometimes lags).

### A.6 — Operational risk we're accepting

1. **Wider port-22 exposure.** ~3,000 CIDRs is roughly tens of millions of IPs. Anyone able to spin up an Azure VM in those ranges can brute-force the VPS. Mitigations:
   - Keep SSH key-only auth (no passwords) — already enforced per `/etc/ssh/sshd_config.d/`.
   - Install `fail2ban` with aggressive jail timing if not already present.
   - Restrict the `pnodepulse` user shell to deploy actions only (no root, no shell access via SSH key forced commands).
2. **Sync drift.** If GH publishes a new range between cron runs and the runner happens to land on it, the deploy fails. Cron every hour instead of daily reduces but does not eliminate this.
3. **UFW rule count.** UFW with thousands of rules works but `ufw status` becomes slow. iptables/nftables direct rules would be faster but require a different sync script. Acceptable for now.
4. **Doesn't generalize.** Each VPS that needs CI access needs the same allowlist. We currently have one (the monolith VPS); pulse-api will use the same one.

### A.7 — Rollback

```bash
# Drop all gha-allow rules in one go.
sudo ufw status numbered | awk -F'[][]' '/# gha-allow/ { print $2 }' | sort -rn | \
  while read n; do sudo ufw --force delete "$n"; done

# Remove the sync.
sudo rm /usr/local/bin/sync-gh-actions-allowlist.sh
sudo crontab -l | grep -v sync-gh-actions-allowlist | sudo crontab -
```

After rollback, CI deploys fail again — switch to Option B or C before doing this.

---

## Option B — SSH through Cloudflare tunnel in CI (sketch)

The local SSH alias `reclabs3` already uses `ProxyCommand cloudflared access ssh --hostname=ssh.rectorspace.com`. CI can do the same:

1. Install `cloudflared` in the runner — `wget` the deb, `dpkg -i`.
2. Authenticate the runner non-interactively using a **service token** (CF Zero Trust → Access → Service Auth → Service Tokens). Two env vars: `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`.
3. Replace `appleboy/ssh-action` with a step that runs `ssh -o ProxyCommand="cloudflared access ssh --hostname=ssh.rectorspace.com --service-token-id=$CF_ACCESS_CLIENT_ID --service-token-secret=$CF_ACCESS_CLIENT_SECRET" pnodepulse@ssh.rectorspace.com 'set -euo pipefail; …'`.
4. Add `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` as GH Actions secrets.

Net effect: no firewall change on the VPS, no recurring sync, and the same auth path (Cloudflare tunnel) is used by operators and CI alike. Rotating the service token rotates CI access without touching the VPS.

Cost: an afternoon of plumbing and one CF Zero Trust seat (already on the Free plan if available).

---

## Option C — Self-hosted runner inside the VPS (sketch)

1. Register a self-hosted runner under the `RECTOR-LABS` org or the `pnode-pulse` repo. GitHub provides the install script and registration token.
2. Run it as a systemd service on the VPS (separate from `pnodepulse`, with its own unprivileged user, e.g. `gha-runner`).
3. Change the deploy workflow's `runs-on:` to the runner's label (e.g. `[self-hosted, vps-pnodepulse]`) and replace the SSH steps with local shell commands (`docker compose up -d`, etc.).

Pros: zero SSH traffic from the public internet; deploys become local commands; no GH meta sync; no Cloudflare dependency. Cons: you maintain a runner (auto-updates, security patches, GH Actions outages now affect this VPS, and the runner has effective root on the deploy path so its container/user isolation matters).

This is the most secure option but the highest one-time setup cost.

---

## Decision needed

- If you want CI deploys working today and accept the IP-sync maintenance cost, do **Option A**.
- If you want the cleaner long-term posture and are OK with an afternoon of plumbing, do **Option B**.
- If you want zero public SSH and are willing to operate a runner on the VPS, do **Option C**.

Whichever you pick, the workflow file change is small and reversible — the bigger commitment is the operational pattern that follows.
