// Compares PatchBuilder output with generatePatch() dumps from the browser
// generator. Float buffers are compared as exact float32 values; a residual of
// one float ULP is tolerated only where rock-outcrop rounding can reach it.
#include "PatchBuilder.h"
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

using namespace StarAgent::Aeon;

static int UlpDistance(float a, float b) {
  if (a == b) return 0;
  int n = 0; float x = a;
  while (x != b && n < 4) { x = std::nextafter(x, b); n++; }
  return n;
}

struct Stat { long total = 0, exact = 0, ulp1 = 0, worse = 0; double maxAbs = 0; };

static void Compare(Stat& s, const std::vector<float>& mine, const std::vector<double>& ref) {
  if (mine.size() != ref.size()) { s.worse += 1000000; return; }
  for (size_t i = 0; i < mine.size(); i++) {
    const float r = static_cast<float>(ref[i]);
    s.total++;
    const int d = UlpDistance(mine[i], r);
    if (d == 0) s.exact++; else if (d == 1) s.ulp1++; else s.worse++;
    s.maxAbs = std::fmax(s.maxAbs, std::fabs(static_cast<double>(mine[i]) - ref[i]));
  }
}

int main(int argc, char** argv) {
  if (argc < 2) { std::fprintf(stderr, "usage: patch-crosscheck <patches.txt>\n"); return 2; }
  std::ifstream in(argv[1]);
  if (!in) { std::fprintf(stderr, "cannot open %s\n", argv[1]); return 2; }
  std::map<std::string, Stat> stats;
  long patches = 0, indexMismatch = 0, centerMismatch = 0;
  std::string line;
  PatchRequest req; PatchBuffers out; bool have = false;
  std::map<std::string, std::vector<double>> ref;
  auto flush = [&]() {
    if (!have) return;
    BuildPatch(req, out);
    patches++;
    const auto& c = ref["center"];
    for (int a = 0; a < 3; a++) if (c[a] != out.center[a]) centerMismatch++;
    Compare(stats["positions"], out.positions, ref["positions"]);
    Compare(stats["normals"], out.normals, ref["normals"]);
    Compare(stats["colors"], out.colors, ref["colors"]);
    Compare(stats["directions"], out.directions, ref["directions"]);
    Compare(stats["waterPositions"], out.waterPositions, ref["waterPositions"]);
    Compare(stats["heights"], out.heights, ref["heights"]);
    Compare(stats["rockReliefs"], out.rockReliefs, ref["rockReliefs"]);
    Compare(stats["parentPositions"], out.parentPositions, ref["parentPositions"]);
    Compare(stats["parentWaterPositions"], out.parentWaterPositions, ref["parentWaterPositions"]);
    Compare(stats["parentNormals"], out.parentNormals, ref["parentNormals"]);
    Compare(stats["parentColors"], out.parentColors, ref["parentColors"]);
    Compare(stats["parentHeights"], out.parentHeights, ref["parentHeights"]);
    const auto& idx = ref["indices"];
    if (idx.size() != out.indices.size()) indexMismatch++;
    else for (size_t i = 0; i < idx.size(); i++) if (static_cast<uint16_t>(idx[i]) != out.indices[i]) { indexMismatch++; break; }
    ref.clear(); have = false;
  };
  while (std::getline(in, line)) {
    if (line.empty()) continue;
    if (line[0] == '#') {
      flush();
      unsigned long seed;
      std::sscanf(line.c_str(), "# %d %d %d %d %d %d %lu", &req.face, &req.level, &req.ix, &req.iy, &req.grid, &req.parentGrid, &seed);
      req.seed = static_cast<uint32_t>(seed); have = true; continue;
    }
    std::istringstream ss(line);
    std::string name; ss >> name;
    std::vector<double>& v = ref[name];
    std::string tok;
    while (ss >> tok) v.push_back(std::strtod(tok.c_str(), nullptr));
  }
  flush();

  std::printf("%ld patches\n", patches);
  bool ok = patches > 0 && indexMismatch == 0 && centerMismatch == 0;
  for (const auto& [name, s] : stats) {
    std::printf("  %-22s exact %ld / %ld, 1-ulp %ld, worse %ld, max |d| %.3e\n", name.c_str(), s.exact, s.total, s.ulp1, s.worse, s.maxAbs);
    if (s.worse != 0 || s.exact < s.total * 0.999) ok = false;
  }
  std::printf("  index buffer mismatches %ld, centre mismatches %ld\n", indexMismatch, centerMismatch);
  std::printf("%s\n", ok ? "PASS: patch builder matches generatePatch" : "FAIL");
  return ok ? 0 : 1;
}
