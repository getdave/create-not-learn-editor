#!/usr/bin/env bash
#
# Moves this branch to the Gutenberg build of the pull request at the top of
# the grid stack (https://github.com/WordPress/gutenberg/stack/85397).
#
# wp-env (`scripts/wp-env.mjs`) and the Playground demo (`demos/blueprint.json`)
# both install that PR's build from Gutenberg's CI, through the proxy
# Playground installs pull requests with. This points them at the PR now on
# top, once its build is ready. Run `npm run wp-env start` afterwards to
# download it, and commit the change so the Playground demo follows.
#
# Exit codes: 0 updated, or already on top; 3 the top PR's build isn't ready
# yet, so nothing changed.

set -euo pipefail

STACK=85397
REPO=WordPress/gutenberg

cd "$( dirname "$0" )/.."

read -r num sha title < <(
	gh api "repos/$REPO/stacks/$STACK" \
		-q '.pull_requests[-1] | "\(.number) \(.head.sha) \(.title)"'
)
short=${sha:0:7}
key="gutenberg-pr-$num-$short"

echo "Top of the stack: #$num $title ($short)"

if grep -q "key: '$key'" scripts/wp-env.mjs; then
	echo "Already on it."
	exit 0
fi

conclusion=$(
	gh api "repos/$REPO/actions/runs?head_sha=$sha" \
		-q '[.workflow_runs[] | select(.name == "Build Gutenberg Plugin Zip")][0] | "\(.status)/\(.conclusion)"'
)

if [ "$conclusion" != "completed/success" ]; then
	echo "Its plugin build is ${conclusion:-not started}, so nothing changed."
	exit 3
fi

sed -i.bak -E \
	-e "s/name: 'Gutenberg #[0-9]+ \(grid stack\)'/name: 'Gutenberg #$num (grid stack)'/" \
	-e "s/key: 'gutenberg-pr-[0-9]+-[0-9a-f]+'/key: '$key'/" \
	-e "s/&pr=[0-9]+'/\&pr=$num'/" \
	scripts/wp-env.mjs
sed -i.bak -E \
	-e "s/&pr=[0-9]+\"/\&pr=$num\"/" \
	-e "s/from the grid stack \(#[0-9]+\)/from the grid stack (#$num)/" \
	demos/blueprint.json
rm scripts/wp-env.mjs.bak demos/blueprint.json.bak

if ! grep -q "key: '$key'" scripts/wp-env.mjs || ! grep -q "pr=$num\"" demos/blueprint.json; then
	echo "Could not update scripts/wp-env.mjs and demos/blueprint.json." >&2
	exit 1
fi

echo "Moved to #$num. Run \`npm run wp-env start\` to download it."
