#!/usr/bin/env bash

set -eu -o pipefail
pushd $(dirname "$(realpath $0)") > /dev/null

node ./lib/uc/index.js "$@"

popd > /dev/null
