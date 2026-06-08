#!/usr/bin/env bash
# Build and push the production lab images to Docker Hub.
#
#   docker login        # once, beforehand (use an access token if 2FA is on)
#   ./publish.sh        # builds + pushes jvargas4/vyos-lab and jvargas4/ansible-lab
#
# Each image is tagged with both :latest and the version from its package.json.
# Override the namespace with: DOCKERHUB_USER=someoneelse ./publish.sh
set -euo pipefail

DOCKERHUB_USER="${DOCKERHUB_USER:-jvargas4}"
cd "$(dirname "$0")"

for lab in vyos-lab ansible-lab; do
  version=$(node -p "require('./$lab/package.json').version")
  image="$DOCKERHUB_USER/$lab"
  echo "==> Building $image ($version)"
  docker build -t "$image:$version" -t "$image:latest" "./$lab"
  echo "==> Pushing $image:$version and :latest"
  docker push "$image:$version"
  docker push "$image:latest"
done

echo "Done. Published under '$DOCKERHUB_USER' (run 'docker login' first if push failed)."
