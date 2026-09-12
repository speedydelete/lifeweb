#!/usr/bin/env bash

set -eu -o pipefail
pushd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" > /dev/null

node ./lib/uc/index.js "$@"

popd > /dev/null
