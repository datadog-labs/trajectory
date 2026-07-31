#!/bin/bash
# Compatibility target for Claude sessions that loaded the pre-1.2.15 Stop hook.
# The retired hook may still run after the marketplace updates in place.
cat >/dev/null || true
exit 0
