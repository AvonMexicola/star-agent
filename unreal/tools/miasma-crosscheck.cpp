// Compares the C++ Miasma port with reference samples from dump-miasma-samples.mjs.
// Exit status 0 means the port is compatible with the browser generator.
//
// Expectations:
//  * Samples without a rock outcrop (rockRelief 0 on both sides) must match
//    BIT FOR BIT, except that `ridge ** 6` goes through V8's Math.pow, which
//    differs from every libm on this machine by one ulp for a few percent of
//    inputs. For such a sample the check recomputes with the pow result moved
//    by +1 and -1 ulp; if one of those reproduces every output bit for bit the
//    residual is proven to be that pow rounding and nothing else. Anything
//    else is a failure.
//  * Outcrop samples must agree to 1e-6 m in height and 1e-9 in other outputs.
//  * MIASMA_POSITION must agree to 1e-3 m.
#include "MiasmaSurface.h"
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <string>
#include <vector>

using namespace StarAgent;

static bool parse(const std::string& line, std::vector<double>& v) {
  v.clear();
  const char* p = line.c_str() + 1;
  while (*p) { char* end; const double d = std::strtod(p, &end); if (end == p) break; v.push_back(d); p = end; }
  return !v.empty();
}
static double amax(double a, double b) { return a > b ? a : b; }
static bool identical(const Miasma::Sample& s, const std::vector<double>& v) {
  return s.height == v[3] && s.rockRelief == v[4] && s.sulphur == v[5] && s.basin == v[6]
    && s.resources.weights[0] == v[8] && s.resources.weights[1] == v[9] && s.resources.weights[2] == v[10]
    && s.color[0] == v[12] && s.color[1] == v[13] && s.color[2] == v[14];
}

int main(int argc, char** argv) {
  if (argc < 2) { std::fprintf(stderr, "usage: miasma-crosscheck <samples.txt>\n"); return 2; }
  std::ifstream in(argv[1]);
  if (!in) { std::fprintf(stderr, "cannot open %s\n", argv[1]); return 2; }
  long total = 0, heightExact = 0, noiseOnly = 0, bitIdentical = 0, powIsolated = 0, noiseExactFail = 0, outcrop = 0, regionMismatch = 0, dominantMismatch = 0, sites = 0;
  double maxH = 0, maxRock = 0, maxOther = 0, maxColor = 0, maxConst = 0, maxPos = -1;
  double worst[3] = {0, 0, 0};
  double seconds = 0;
  std::string line; std::vector<double> v;
  while (std::getline(in, line)) {
    if (line.empty() || !parse(line, v)) continue;
    const char tag = line[0];
    if (tag == 'S') {
      if (v.size() != 15) { std::fprintf(stderr, "bad S line\n"); return 2; }
      const double x = v[0], y = v[1], z = v[2];
      const auto t0 = std::chrono::steady_clock::now();
      Miasma::SetPowUlpAdjustForTesting(0);
      const Miasma::Sample s = Miasma::Surface(x, y, z);
      seconds += std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
      total++;
      const double dh = std::fabs(s.height - v[3]), dr = std::fabs(s.rockRelief - v[4]);
      double dOther = amax(amax(std::fabs(s.sulphur - v[5]), std::fabs(s.basin - v[6])), amax(amax(std::fabs(s.resources.weights[0] - v[8]), std::fabs(s.resources.weights[1] - v[9])), std::fabs(s.resources.weights[2] - v[10])));
      double dColor = 0;
      for (int i = 0; i < 3; i++) dColor = amax(dColor, std::fabs(s.color[i] - v[12 + i]));
      if (s.height == v[3]) heightExact++;
      if (s.exact && v[4] == 0) {
        noiseOnly++;
        if (identical(s, v)) bitIdentical++;
        else {
          bool isolated = false;
          for (int adj : {1, -1}) {
            Miasma::SetPowUlpAdjustForTesting(adj);
            if (identical(Miasma::Surface(x, y, z), v)) { isolated = true; break; }
          }
          Miasma::SetPowUlpAdjustForTesting(0);
          if (isolated) powIsolated++;
          else { noiseExactFail++; if (noiseExactFail <= 5) std::fprintf(stderr, "noise-only mismatch at %.17g %.17g %.17g: js height %.17g c++ %.17g\n", x, y, z, v[3], s.height); }
        }
      } else outcrop++;
      if (dh > maxH) { maxH = dh; worst[0] = x; worst[1] = y; worst[2] = z; }
      maxRock = amax(maxRock, dr); maxOther = amax(maxOther, dOther); maxColor = amax(maxColor, dColor);
      if (static_cast<int>(s.region) != static_cast<int>(v[7])) { regionMismatch++; if (regionMismatch <= 5) std::fprintf(stderr, "region mismatch at %.17g %.17g %.17g: js %d c++ %d\n", x, y, z, static_cast<int>(v[7]), static_cast<int>(s.region)); }
      if (s.resources.dominant != static_cast<int>(v[11])) dominantMismatch++;
    } else if (tag == 'T') {
      const Miasma::Site& site = Miasma::Sites()[static_cast<int>(v[0])];
      sites++;
      for (int i = 0; i < 3; i++) maxConst = amax(maxConst, std::fabs(site.direction[i] - v[1 + i]));
      if (site.radius != v[4] || site.depth != v[5]) maxConst = amax(maxConst, 1.0);
    } else if (tag == 'M') {
      const Pyre::Frame f = Pyre::FrameAt(v[0], v[0]);
      double p[3]; Miasma::Position(f, p);
      maxPos = 0;
      for (int i = 0; i < 3; i++) maxPos = amax(maxPos, std::fabs(p[i] - v[1 + i]));
    }
  }
  std::printf("miasma: %ld surface samples\n", total);
  std::printf("  height bit-identical            %ld / %ld\n", heightExact, total);
  std::printf("  noise-only samples              %ld  (no outcrop; must be bit-identical up to V8's pow rounding)\n", noiseOnly);
  std::printf("    bit-identical                 %ld\n", bitIdentical);
  std::printf("    identical after +-1 ulp on `ridge ** 6`  %ld  (residual proven to be Math.pow rounding)\n", powIsolated);
  std::printf("    unexplained mismatches        %ld\n", noiseExactFail);
  std::printf("  outcrop samples                 %ld  (tolerance applies)\n", outcrop);
  std::printf("  max |dheight|   %.3e m  at (%.6f, %.6f, %.6f)\n", maxH, worst[0], worst[1], worst[2]);
  std::printf("  max |drock|     %.3e m\n", maxRock);
  std::printf("  max |dother|    %.3e  (sulphur, basin, weights)\n", maxOther);
  std::printf("  max |dcolour|   %.3e\n", maxColor);
  std::printf("  region mismatches %ld, dominant-resource mismatches %ld\n", regionMismatch, dominantMismatch);
  std::printf("  site constants: %ld checked, max |d| %.3e; MIASMA_POSITION max |d| %.3e m\n", sites, maxConst, maxPos);
  std::printf("  Surface cost %.1f us / call (single thread, this machine)\n", total ? seconds / total * 1e6 : 0.0);
  const bool ok = noiseOnly > 0 && noiseExactFail == 0 && regionMismatch == 0 && dominantMismatch == 0 && maxH <= 1e-6 && maxRock <= 1e-6 && maxOther <= 1e-9 && maxColor <= 1e-9
    && sites > 0 && maxConst <= 1e-15 && maxPos >= 0 && maxPos <= 1e-3;
  std::printf("%s\n", ok ? "PASS: C++ Miasma port is compatible with the JavaScript generator" : "FAIL");
  return ok ? 0 : 1;
}
