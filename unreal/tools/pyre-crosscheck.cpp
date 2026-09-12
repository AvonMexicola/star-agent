// Compares the C++ Pyre port with reference samples from dump-pyre-samples.mjs.
// Exit status 0 means the port is compatible with the browser generator.
//
// Expectations:
//  * Samples with no volcano, crater or lava field in range and no rock outcrop
//    (Sample::exact, and rockRelief 0 in the reference) are pure hash/polynomial
//    arithmetic and must match BIT FOR BIT.
//  * Volcano flanks use std::sin/cos/atan2 (one-ulp differences from V8's
//    fdlibm), feature directions come from cos/sin constants, and rock outcrops
//    use sin/cos/pow: those samples must agree to 1e-6 m in height and 1e-9 in
//    every other output. Regions and dominant resources must match exactly.
//  * Orbit positions (up to 1e10 m) must agree to 1e-3 m, frame axes to 1e-12.
#include "PyreSurface.h"
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

int main(int argc, char** argv) {
  if (argc < 2) { std::fprintf(stderr, "usage: pyre-crosscheck <samples.txt>\n"); return 2; }
  std::ifstream in(argv[1]);
  if (!in) { std::fprintf(stderr, "cannot open %s\n", argv[1]); return 2; }
  long total = 0, heightExact = 0, noiseOnly = 0, noiseExactFail = 0, transcendental = 0, regionMismatch = 0, dominantMismatch = 0;
  double maxH = 0, maxRock = 0, maxOther = 0, maxColor = 0, maxConst = 0, maxOrbit = 0, maxAxis = 0, periodRel = 0, maxLanding = 0;
  double worst[3] = {0, 0, 0};
  long constants = 0, orbits = 0;
  double seconds = 0;
  bool haveP = false;
  std::string line; std::vector<double> v;
  while (std::getline(in, line)) {
    if (line.empty() || !parse(line, v)) continue;
    const char tag = line[0];
    if (tag == 'S') {
      if (v.size() != 17) { std::fprintf(stderr, "bad S line\n"); return 2; }
      const double x = v[0], y = v[1], z = v[2];
      const auto t0 = std::chrono::steady_clock::now();
      const Pyre::Sample s = Pyre::SurfaceBody(x, y, z);
      seconds += std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
      total++;
      const double dh = std::fabs(s.height - v[3]), dr = std::fabs(s.rockRelief - v[4]);
      double dOther = 0;
      const double others[7] = {s.activity - v[5], s.fresh - v[6], s.sulphur - v[7], s.oxide - v[8], s.resources.weights[0] - v[10], s.resources.weights[1] - v[11], s.resources.weights[2] - v[12]};
      for (double d : others) dOther = amax(dOther, std::fabs(d));
      double dColor = 0;
      for (int i = 0; i < 3; i++) dColor = amax(dColor, std::fabs(s.color[i] - v[14 + i]));
      const bool allExact = s.height == v[3] && s.rockRelief == v[4] && s.activity == v[5] && s.fresh == v[6] && s.sulphur == v[7] && s.oxide == v[8]
        && s.resources.weights[0] == v[10] && s.resources.weights[1] == v[11] && s.resources.weights[2] == v[12]
        && s.color[0] == v[14] && s.color[1] == v[15] && s.color[2] == v[16];
      if (s.height == v[3]) heightExact++;
      if (s.exact && v[4] == 0) { noiseOnly++; if (!allExact) { noiseExactFail++; if (noiseExactFail <= 5) std::fprintf(stderr, "noise-only mismatch at %.17g %.17g %.17g: js height %.17g c++ %.17g\n", x, y, z, v[3], s.height); } }
      else transcendental++;
      if (dh > maxH) { maxH = dh; worst[0] = x; worst[1] = y; worst[2] = z; }
      maxRock = amax(maxRock, dr); maxOther = amax(maxOther, dOther); maxColor = amax(maxColor, dColor);
      if (static_cast<int>(s.region) != static_cast<int>(v[9])) { regionMismatch++; if (regionMismatch <= 5) std::fprintf(stderr, "region mismatch at %.17g %.17g %.17g: js %d c++ %d\n", x, y, z, static_cast<int>(v[9]), static_cast<int>(s.region)); }
      if (s.resources.dominant != static_cast<int>(v[13])) dominantMismatch++;
    } else if (tag == 'V' || tag == 'F') {
      const Pyre::Feature& f = (tag == 'V' ? Pyre::Volcanoes() : Pyre::LavaFields())[static_cast<int>(v[0])];
      constants++;
      for (int i = 0; i < 3; i++) { maxConst = amax(maxConst, std::fabs(f.direction[i] - v[1 + i])); maxConst = amax(maxConst, std::fabs(f.east[i] - v[4 + i])); maxConst = amax(maxConst, std::fabs(f.north[i] - v[7 + i])); }
      maxConst = amax(maxConst, std::fabs(f.radius - v[10]));
    } else if (tag == 'C') {
      const Pyre::Crater& c = Pyre::Craters()[static_cast<int>(v[0])];
      constants++;
      for (int i = 0; i < 3; i++) maxConst = amax(maxConst, std::fabs(c.direction[i] - v[1 + i]));
      if (c.radius != v[4] || c.depth != v[5]) { maxConst = amax(maxConst, 1.0); std::fprintf(stderr, "crater %d radius/depth not bit-identical\n", static_cast<int>(v[0])); }
    } else if (tag == 'O') {
      const Pyre::Frame f = Pyre::FrameAt(v[0], v[1]);
      orbits++;
      for (int i = 0; i < 3; i++) { maxOrbit = amax(maxOrbit, std::fabs(f.position[i] - v[2 + i])); maxAxis = amax(maxAxis, std::fabs(f.x[i] - v[5 + i])); maxAxis = amax(maxAxis, std::fabs(f.y[i] - v[8 + i])); maxAxis = amax(maxAxis, std::fabs(f.z[i] - v[11 + i])); }
    } else if (tag == 'P') {
      haveP = true; periodRel = std::fabs(Pyre::PeriodSeconds() - v[0]) / v[0];
    } else if (tag == 'L') {
      double d[3]; Pyre::LandingBodyDirection(d);
      for (int i = 0; i < 3; i++) maxLanding = amax(maxLanding, std::fabs(d[i] - v[i]));
    }
  }
  std::printf("pyre: %ld surface samples\n", total);
  std::printf("  height bit-identical          %ld / %ld\n", heightExact, total);
  std::printf("  noise-only samples            %ld  (no feature in range, no outcrop; every output must be bit-identical)\n", noiseOnly);
  std::printf("  noise-only exactness fails    %ld\n", noiseExactFail);
  std::printf("  feature/outcrop samples       %ld  (sin/cos/atan2 or outcrop involved; tolerance applies)\n", transcendental);
  std::printf("  max |dheight|   %.3e m  at (%.6f, %.6f, %.6f)\n", maxH, worst[0], worst[1], worst[2]);
  std::printf("  max |drock|     %.3e m\n", maxRock);
  std::printf("  max |dother|    %.3e  (activity, fresh, sulphur, oxide, weights)\n", maxOther);
  std::printf("  max |dcolour|   %.3e\n", maxColor);
  std::printf("  region mismatches %ld, dominant-resource mismatches %ld\n", regionMismatch, dominantMismatch);
  std::printf("  feature/crater constants: %ld checked, max |d| %.3e\n", constants, maxConst);
  std::printf("  orbit frames: %ld checked, max |dposition| %.3e m, max |daxis| %.3e, period rel diff %.3e, landing dir |d| %.3e\n", orbits, maxOrbit, maxAxis, periodRel, maxLanding);
  std::printf("  SurfaceBody cost %.1f us / call (single thread, this machine)\n", total ? seconds / total * 1e6 : 0.0);
  const bool ok = noiseOnly > 0 && noiseExactFail == 0 && regionMismatch == 0 && dominantMismatch == 0 && maxH <= 1e-6 && maxRock <= 1e-6 && maxOther <= 1e-9 && maxColor <= 1e-9
    && constants > 0 && maxConst <= 1e-15 && orbits > 0 && maxOrbit <= 1e-3 && maxAxis <= 1e-12 && haveP && periodRel <= 1e-12 && maxLanding <= 1e-15;
  std::printf("%s\n", ok ? "PASS: C++ Pyre port is compatible with the JavaScript generator" : "FAIL");
  return ok ? 0 : 1;
}
