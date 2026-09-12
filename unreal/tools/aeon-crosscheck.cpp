// Compares the C++ Aeon surface port with reference samples dumped from the
// JavaScript generator (dump-aeon-samples.mjs). Exit status 0 means the port is
// seed-compatible with the browser build for the given file.
//
// Expectations:
//  * Where no rock formation contributes (rockRelief == 0 on both sides), the
//    height is pure hash/polynomial arithmetic and must match BIT FOR BIT.
//  * The rock layer uses sin/cos/pow, where V8 (fdlibm) and glibc may differ in
//    the last bit. Those samples must agree to 1e-6 m (they agree far better).
//  * Moisture and colour use cos/atan and get the same tolerance; biomes must match.
#include "AeonSurface.h"
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <fstream>

using namespace StarAgent::Aeon;

int main(int argc, char** argv) {
  if (argc < 3) { std::fprintf(stderr, "usage: aeon-crosscheck <samples.txt> <seed>\n"); return 2; }
  std::ifstream in(argv[1]);
  if (!in) { std::fprintf(stderr, "cannot open %s\n", argv[1]); return 2; }
  const uint32_t seed = static_cast<uint32_t>(std::strtoul(argv[2], nullptr, 10));

  long total = 0, noiseOnly = 0, noiseExactFail = 0, heightExact = 0, biomeMismatch = 0, rockNonzeroBothSides = 0;
  double maxH = 0, maxRock = 0, maxM = 0, maxC = 0;
  double worstX = 0, worstY = 0, worstZ = 0;
  double sampleSeconds = 0;
  std::string line;
  while (std::getline(in, line)) {
    if (line.empty()) continue;
    double v[10];
    const char* p = line.c_str();
    for (int i = 0; i < 10; i++) { char* end; v[i] = std::strtod(p, &end); if (end == p) { std::fprintf(stderr, "bad line: %s\n", line.c_str()); return 2; } p = end; }
    const double x = v[0], y = v[1], z = v[2];
    const auto t0 = std::chrono::steady_clock::now();
    const Sample s = TerrainSample(x, y, z, seed);
    sampleSeconds += std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
    const double m = Moisture(x, y, z, seed);
    const Biome b = BiomeAt(x, y, z, s.height, seed);
    double c[3]; SurfaceColor(x, y, z, s.height, SlopeAt(x, y, z, s.height, seed), seed, c);

    total++;
    const double dh = std::fabs(s.height - v[3]), dr = std::fabs(s.rockRelief - v[4]), dm = std::fabs(m - v[5]);
    const double dc = std::fmax(std::fabs(c[0] - v[7]), std::fmax(std::fabs(c[1] - v[8]), std::fabs(c[2] - v[9])));
    if (s.height == v[3]) heightExact++;
    if (v[4] == 0 && s.rockRelief == 0) { noiseOnly++; if (s.height != v[3]) noiseExactFail++; }
    if (v[4] != 0 && s.rockRelief != 0) rockNonzeroBothSides++;
    if (dh > maxH) { maxH = dh; worstX = x; worstY = y; worstZ = z; }
    if (dr > maxRock) maxRock = dr;
    if (dm > maxM) maxM = dm;
    if (dc > maxC) maxC = dc;
    if (static_cast<int>(b) != static_cast<int>(v[6])) { biomeMismatch++; if (biomeMismatch <= 5) std::fprintf(stderr, "biome mismatch at %.17g %.17g %.17g: js %d c++ %d (height %.17g)\n", x, y, z, static_cast<int>(v[6]), static_cast<int>(b), s.height); }
  }

  std::printf("seed %u: %ld samples\n", seed, total);
  std::printf("  height bit-identical         %ld / %ld\n", heightExact, total);
  std::printf("  noise-only samples           %ld  (rock relief 0 on both sides; must be bit-identical)\n", noiseOnly);
  std::printf("  noise-only exactness fails   %ld\n", noiseExactFail);
  std::printf("  rock samples (both nonzero)  %ld\n", rockNonzeroBothSides);
  std::printf("  max |dheight|   %.3e m  at (%.6f, %.6f, %.6f)\n", maxH, worstX, worstY, worstZ);
  std::printf("  max |drock|     %.3e m\n", maxRock);
  std::printf("  max |dmoisture| %.3e\n", maxM);
  std::printf("  max |dcolour|   %.3e\n", maxC);
  std::printf("  biome mismatches %ld\n", biomeMismatch);
  std::printf("  TerrainSample cost %.1f us / call (single thread, this machine)\n", total ? sampleSeconds / total * 1e6 : 0.0);

  const bool ok = noiseExactFail == 0 && biomeMismatch == 0 && maxH <= 1e-6 && maxM <= 1e-9 && maxC <= 1e-9 && noiseOnly > 0;
  std::printf("%s\n", ok ? "PASS: C++ port is seed-compatible with the JavaScript generator" : "FAIL");
  return ok ? 0 : 1;
}
