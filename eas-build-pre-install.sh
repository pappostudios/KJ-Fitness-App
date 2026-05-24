#!/usr/bin/env bash
# EAS Build pre-install hook
# Decodes the GOOGLE_SERVICES_JSON secret and writes it to the expected path.
# The secret is a base64-encoded version of android/app/google-services.json.

set -euo pipefail

if [ -n "${GOOGLE_SERVICES_JSON:-}" ]; then
  echo "Writing google-services.json from EAS secret..."
  echo "$GOOGLE_SERVICES_JSON" | base64 --decode > android/app/google-services.json
  echo "google-services.json written successfully."
else
  echo "WARNING: GOOGLE_SERVICES_JSON env var not set — build may fail if file is missing."
fi
