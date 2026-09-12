#!/usr/bin/env bash
# Builds the engine-free world-generation ports with a plain system compiler and
# checks them against samples produced by the JavaScript generators.
# Needs node (22+) and g++ or clang++, plus node_modules at the repository root.
# No Unreal Engine required. Exit status 0 means every check passed.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build
CXX=${CXX:-$(command -v clang++ || command -v g++)}
WG=../Source/StarAgent/WorldGen
# -ffp-contract=off: fused multiply-add changes the last bit and would break seed compatibility.
FLAGS=(-std=c++17 -O2 -ffp-contract=off -Wall -Wextra -I"$WG")

"$CXX" "${FLAGS[@]}" -o build/aeon-crosscheck aeon-crosscheck.cpp "$WG/AeonSurface.cpp"
for seed in ${SEEDS:-7291 42}; do
  node dump-aeon-samples.mjs --seed "$seed" --count "${COUNT:-20000}" > "build/aeon-$seed.txt"
  ./build/aeon-crosscheck "build/aeon-$seed.txt" "$seed"
done

"$CXX" "${FLAGS[@]}" -o build/patch-crosscheck patch-crosscheck.cpp "$WG/PatchBuilder.cpp" "$WG/AeonSurface.cpp"
node dump-aeon-patches.mjs --seed 7291 > build/aeon-patches.txt
./build/patch-crosscheck build/aeon-patches.txt

for body in selene pyre miasma; do
  src="$WG/$(python3 -c "print('$body'.capitalize())")Surface.cpp"
  if [ -f "$body-crosscheck.cpp" ] && [ -f "$src" ]; then
    # Every body may use the shared resource profile, the fdlibm pow/exp port and Pyre's frame (Miasma orbits Pyre).
    "$CXX" "${FLAGS[@]}" -o "build/$body-crosscheck" "$body-crosscheck.cpp" "$src" "$WG/AeonSurface.cpp" "$WG/ResourceProfile.cpp" "$WG/JsLibm.cpp" $( [ "$body" = miasma ] && echo "$WG/PyreSurface.cpp" )
    node "dump-$body-samples.mjs" > "build/$body.txt"
    "./build/$body-crosscheck" "build/$body.txt"
  fi
done
