#!/usr/bin/env sh
set -eu

IMAGE_NAME="${1:-jinrou-new}"
IMAGE_TAG="${2:-latest}"
OUTPUT_FILE="${3:-dist/${IMAGE_NAME}-${IMAGE_TAG}.tar}"
APP_CONFIG="${4:-config/app-image.coffee}"

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DOCKERFILE="${SCRIPT_DIR}/Dockerfile"

if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker command not found" >&2
  exit 1
fi

if [ ! -f "${DOCKERFILE}" ]; then
  echo "error: Dockerfile not found at ${DOCKERFILE}" >&2
  exit 1
fi

if [ ! -d "${SCRIPT_DIR}/config" ]; then
  echo "error: config directory not found. Copy config.default to config before building." >&2
  exit 1
fi

if [ ! -f "${SCRIPT_DIR}/${APP_CONFIG}" ]; then
  echo "error: image config file not found at ${SCRIPT_DIR}/${APP_CONFIG}" >&2
  exit 1
fi

OUTPUT_DIR=$(dirname -- "${OUTPUT_FILE}")
mkdir -p "${OUTPUT_DIR}"

FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"

echo "Building Docker image: ${FULL_IMAGE_NAME}"
docker build \
  --build-arg "APP_CONFIG=${APP_CONFIG}" \
  -f "${DOCKERFILE}" \
  -t "${FULL_IMAGE_NAME}" \
  "${SCRIPT_DIR}"

echo "Saving Docker image to: ${OUTPUT_FILE}"
docker save -o "${OUTPUT_FILE}" "${FULL_IMAGE_NAME}"

echo "Done: ${OUTPUT_FILE}"
