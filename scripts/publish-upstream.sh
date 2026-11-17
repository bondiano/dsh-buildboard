#!/usr/bin/env bash
# Publish the workstation snapshot of dsh-buildboard to GitHub.
set -euo pipefail
root=$(cd -- "$(dirname -- "$0")/.." && pwd -P)
workstation=$(cd -- "$root/../.." && pwd -P)
tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT

git clone --depth 1 https://github.com/bondiano/dsh-buildboard.git "$tmp/repo"
cd "$tmp/repo"
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cd "$root"
git -C "$workstation" ls-files -z --cached --others --exclude-standard -- extensions/dsh/dsh-buildboard \
	| while IFS= read -r -d '' path; do
			[[ -e "$workstation/$path" ]] || continue
			rel=${path#extensions/dsh/dsh-buildboard/}
			mkdir -p "$tmp/repo/$(dirname -- "$rel")"
			cp -a "$workstation/$path" "$tmp/repo/$rel"
		done
cd "$tmp/repo"
git add -A
if git diff --cached --quiet; then
	echo "nothing to publish"
	git rev-parse HEAD
	exit 0
fi
git commit -m "$(cat <<'EOF'
feat: tldraw buildboard with cards, runs and /canvas

EOF
)"
git push origin HEAD
git rev-parse HEAD
