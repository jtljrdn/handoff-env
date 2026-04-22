#!/bin/sh
# Bump packages/cli's version, commit, and tag.
#
# Sidesteps `npm version` because npm can't resolve the `workspace:*`
# protocol in package.json and explodes on the implicit install step.
#
# Usage:
#   ./scripts/release-cli.sh              # patch (default): 0.1.0 -> 0.1.1
#   ./scripts/release-cli.sh patch
#   ./scripts/release-cli.sh minor        # 0.1.x -> 0.2.0
#   ./scripts/release-cli.sh major        # 0.x.y -> 1.0.0
#   ./scripts/release-cli.sh 1.2.3        # explicit version
#
# After the tag is created, push with:
#   git push --follow-tags

set -eu

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

PKG_PATH="packages/cli/package.json"
BUMP="${1:-patch}"

if [ ! -f "$PKG_PATH" ]; then
  echo "error: $PKG_PATH not found" >&2
  exit 1
fi

if ! git diff --quiet HEAD -- "$PKG_PATH"; then
  echo "error: $PKG_PATH has uncommitted changes. Commit or stash first." >&2
  exit 1
fi

NEW_VERSION=$(node -e "
  const fs = require('fs');
  const path = process.argv[1];
  const bump = process.argv[2];
  const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
  let next;
  if (/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(bump)) {
    next = bump;
  } else {
    const parts = pkg.version.split('.').map(Number);
    if (bump === 'major')      { parts[0]++; parts[1] = 0; parts[2] = 0; }
    else if (bump === 'minor') {              parts[1]++; parts[2] = 0; }
    else if (bump === 'patch') {                           parts[2]++; }
    else { console.error('unknown bump: ' + bump); process.exit(2); }
    next = parts.join('.');
  }
  pkg.version = next;
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
  console.log(next);
" "$PKG_PATH" "$BUMP")

TAG="v${NEW_VERSION}"

git add "$PKG_PATH"
git commit -m "release: handoff-env ${TAG}"
git tag -a "$TAG" -m "handoff-env ${TAG}"

echo
echo "Tagged ${TAG}. Push with:"
echo "  git push --follow-tags"
