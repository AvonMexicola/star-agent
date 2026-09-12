// Compares the C++ Selene surface port with reference samples dumped from the
// JavaScript generator (dump-selene-samples.mjs). Exit status 0 means the port
// reproduces the browser moon.
//
// Expectations:
//  * "Pure" samples (IsTranscendentalFree: outside every crater apron and
//    province, no ridge highlands, outside the landing cap) with zero rock
//    relief on both sides involve only hash/polynomial arithmetic and must
//    match BIT FOR BIT: height, albedo, frost, colour and resource weights.
//  * Everywhere else craters use exp, ridges use pow, the landing basin uses
//    sin/cos/atan2 and the provinces use sin. Node's V8 and glibc disagree in
//    the last bit for a few percent of those calls (measured), so those samples
//    get tolerances: 1e-6 m for height, 1e-9 for the other outputs.
//  * dominant resource, province and region must match exactly.
#include "SeleneSurface.h"
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <string>

using namespace StarAgent::Selene;

int main(int argc, char** argv) {
  if (argc < 2) { std::fprintf(stderr, "usage: selene-crosscheck <samples.txt>\n"); return 2; }
  std::ifstream in(argv[1]);
  if (!in) { std::fprintf(stderr, "cannot open %s\n", argv[1]); return 2; }

  long total = 0, heightExact = 0, pure = 0, pureFails = 0, rockBoth = 0, catMismatch = 0, landingCap = 0;
  double maxH = 0, maxRock = 0, maxAlbedo = 0, maxFrost = 0, maxColor = 0, maxWeight = 0;
  double worstX = 0, worstY = 0, worstZ = 0, seconds = 0;
  std::string line;
  while (std::getline(in, line)) {
    if (line.empty()) continue;
    double v[16]; const char* p = line.c_str();
    for (int i = 0; i < 16; i++) { char* end; v[i] = std::strtod(p, &end); if (end == p) { std::fprintf(stderr, "bad line: %s\n", line.c_str()); return 2; } p = end; }
    const double x = v[0], y = v[1], z = v[2];
    const auto t0 = std::chrono::steady_clock::now();
    const Sample s = MoonSurface(x, y, z);
    seconds += std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
    const Place region = MoonRegion(x, y, z);
    total++;
    const double* ld = LandingDirection();
    if (x * ld[0] + y * ld[1] + z * ld[2] > .997) landingCap++;

    const double dh = std::fabs(s.height - v[3]), dr = std::fabs(s.rockRelief - v[4]), da = std::fabs(s.albedo - v[5]), df = std::fabs(s.frost - v[6]);
    double dc = 0, dw = 0;
    for (int i = 0; i < 3; i++) { dc = std::fmax(dc, std::fabs(s.color[i] - v[7 + i])); dw = std::fmax(dw, std::fabs(s.resources.weights[i] - v[10 + i])); }
    if (s.height == v[3]) heightExact++;
    if (v[4] != 0 && s.rockRelief != 0) rockBoth++;
    if (dh > maxH) { maxH = dh; worstX = x; worstY = y; worstZ = z; }
    maxRock = std::fmax(maxRock, dr); maxAlbedo = std::fmax(maxAlbedo, da); maxFrost = std::fmax(maxFrost, df); maxColor = std::fmax(maxColor, dc); maxWeight = std::fmax(maxWeight, dw);

    if (v[4] == 0 && s.rockRelief == 0 && IsTranscendentalFree(x, y, z)) {
      pure++;
      bool exact = s.height == v[3] && s.albedo == v[5] && s.frost == v[6];
      for (int i = 0; i < 3; i++) exact = exact && s.color[i] == v[7 + i] && s.resources.weights[i] == v[10 + i];
      if (!exact) { pureFails++; if (pureFails <= 5) std::fprintf(stderr, "pure sample not bit-identical at %.17g %.17g %.17g: js height %.17g c++ %.17g\n", x, y, z, v[3], s.height); }
    }
    const int dom = static_cast<int>(s.resources.dominant), prov = static_cast<int>(s.resources.province), reg = static_cast<int>(region);
    if (dom != static_cast<int>(v[13]) || prov != static_cast<int>(v[14]) || reg != static_cast<int>(v[15])) {
      catMismatch++;
      if (catMismatch <= 5) std::fprintf(stderr, "categorical mismatch at %.17g %.17g %.17g: js %d/%d/%d c++ %d/%d/%d\n", x, y, z, (int)v[13], (int)v[14], (int)v[15], dom, prov, reg);
    }
  }

  std::printf("selene: %ld samples (%ld inside the landing cap)\n", total, landingCap);
  std::printf("  height bit-identical         %ld / %ld\n", heightExact, total);
  std::printf("  pure samples                 %ld  (no exp/pow/sin/cos terms, rock relief 0 both sides; must be bit-identical)\n", pure);
  std::printf("  pure exactness fails         %ld\n", pureFails);
  std::printf("  rock samples (both nonzero)  %ld\n", rockBoth);
  std::printf("  max |dheight|   %.3e m  at (%.6f, %.6f, %.6f)\n", maxH, worstX, worstY, worstZ);
  std::printf("  max |drock|     %.3e m\n", maxRock);
  std::printf("  max |dalbedo|   %.3e\n", maxAlbedo);
  std::printf("  max |dfrost|    %.3e\n", maxFrost);
  std::printf("  max |dcolour|   %.3e\n", maxColor);
  std::printf("  max |dweights|  %.3e\n", maxWeight);
  std::printf("  categorical mismatches (dominant/province/region) %ld\n", catMismatch);
  std::printf("  MoonSurface cost %.1f us / call (single thread, this machine)\n", total ? seconds / total * 1e6 : 0.0);
  const bool ok = pure > 0 && pureFails == 0 && catMismatch == 0 && maxH <= 1e-6 && maxAlbedo <= 1e-9 && maxFrost <= 1e-9 && maxColor <= 1e-9 && maxWeight <= 1e-9;
  std::printf("%s\n", ok ? "PASS: C++ port reproduces the JavaScript Selene generator" : "FAIL");
  return ok ? 0 : 1;
}
