# Benchmark — <task / scene>

Question and thresholds set before measurement:
Baseline/candidate commits and asset hashes:
Hardware, OS, browser/version, GPU/backend, CPU/RAM:
Seed, pose/route/time, viewport/device/render scale and quality settings:
Input route, sample duration, warm-up, repetitions and competing load:

## Measurements

Cold preload, warm steady state and traversal separately. Median/p95 frame time,
draw calls, triangles, memory and resource growth. For online work: clients/entities,
server hardware/tick rate, bandwidth, RTT/loss and p95 tick delay. Attach sanitized
raw data outside source history when large; retain enough summary to reproduce.

## Interpretation

Observed improvement/regression, uncertainty and unsupported platforms/scenarios.
Software rendering is not hardware FPS evidence. No changed camera/settings silently
sold as an optimization. Describe the next decision supported by the result.
