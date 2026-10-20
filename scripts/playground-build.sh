#!/usr/bin/env bash
#
# Puts together the files a Playground demo installs, for
# .github/workflows/plugin-zip.yml to publish. Run it from the repo root after
# `npm run plugin-zip`.
#
# Usage: scripts/playground-build.sh <kind> <name> <ref> <out-dir>
#
#   kind     trunk, branch or release.
#   name     The branch or tag being built, such as getdave/my-change or v0.2.0.
#   ref      The ref the files are published to, such as
#            refs/playground/getdave/my-change. raw.githubusercontent.com takes
#            it as it is, slashes and all.
#   out-dir  Where to put the files. It must not exist yet.
#
# Trunk uses demos/blueprint.json as it is. A branch or release gets a
# blueprint.json of its own, rewritten from it to install from <ref>. A release
# also pins WordPress to the version wp-env runs, so it stays the same while
# WordPress moves on.

set -euo pipefail

if [ $# -ne 4 ]; then
	echo "Usage: $0 <trunk|branch|release> <name> <ref> <out-dir>" >&2
	exit 1
fi

kind=$1
name=$2
ref=$3
out=$4
repo=${GITHUB_REPOSITORY:-getdave/create-not-learn-editor}
sha=${GITHUB_SHA:-$(git rev-parse HEAD)}

case $kind in
	trunk | branch | release) ;;
	*)
		echo "Unknown kind \"$kind\", expected trunk, branch or release." >&2
		exit 1
		;;
esac

mkdir "$out"
out=$(cd "$out" && pwd)
cp "${ZIP_NAME:-create-not-learn-editor.zip}" "$out/create-not-learn-editor.zip"
cp scripts/demo-site/seed.php demos/playground-canvas-fix.php "$out/"
(cd themes && zip -qr "$out/mainstay.zip" mainstay)

wp=''
case $kind in
	trunk)
		about="Do not edit or commit to this branch, it is replaced on every push to trunk."
		files="[\`demos/blueprint.json\`](https://github.com/$repo/blob/trunk/demos/blueprint.json)"
		;;
	branch)
		title="Create Not Learn Editor ($name)"
		description="Create Not Learn Editor from the $name branch, with Gutenberg, the Mainstay theme and the Fernhouse demo site."
		about="It is the Playground build of the [\`$name\`](https://github.com/$repo/tree/$name) branch, replaced on every push to it and deleted with it. Do not edit or commit to this ref."
		files="[\`blueprint.json\`](blueprint.json)"
		;;
	release)
		# Playground takes major versions, such as 7.1, not patch releases.
		wp=$(grep -oE "wordpress\.org/wordpress-[0-9]+\.[0-9]+" scripts/wp-env.mjs | head -n1 | sed 's#.*wordpress-##')
		if [ -z "$wp" ]; then
			echo "Could not find the WordPress version in scripts/wp-env.mjs" >&2
			exit 1
		fi
		title="Create Not Learn Editor $name"
		description="Create Not Learn Editor $name, on WordPress $wp, with Gutenberg, the Mainstay theme and the Fernhouse demo site."
		about="It is the Playground build of the \`$name\` release. Do not edit or move this tag."
		files="[\`blueprint.json\`](blueprint.json)"
		;;
esac

if [ "$kind" != trunk ]; then
	jq --tab \
		--arg ref "$ref" \
		--arg title "$title" \
		--arg description "$description" \
		--arg wp "$wp" '
			walk(if type == "string" then sub("/playground-build/"; "/\($ref)/") else . end)
			| .meta.title = $title
			| .meta.description = $description
			| if $wp != "" then .preferredVersions.wp = $wp else . end
		' demos/blueprint.json > "$out/blueprint.json"

	if grep -q "/playground-build/" "$out/blueprint.json"; then
		echo "The blueprint still installs from the playground-build branch." >&2
		exit 1
	fi
fi

cat > "$out/README.md" <<EOF
# Playground build

Generated from [\`${sha:0:7}\`](https://github.com/$repo/commit/$sha) by \`.github/workflows/plugin-zip.yml\`. $about

These are the files $files installs.
EOF
