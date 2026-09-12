#include "PatchBuilder.h"
#include "JsMath.h"
#include <cmath>
#include <unordered_map>

using namespace StarAgent::Js;

namespace StarAgent { namespace Aeon {
namespace {

struct VertexSample {
  double d[3];
  double h, rockRelief;
  double color[3];
  double normal[3];
  // Filled for parent samples only (world.js parentVertex): already float-rounded
  // parent-local values re-expressed in this patch's frame, in doubles.
  double position[3], water[3];
};

struct Builder {
  const PatchRequest& r;
  double size, u0, v0;
  double center[3];

  explicit Builder(const PatchRequest& request) : r(request) {
    size = 2.0 / std::pow(2.0, r.level);
    u0 = -1 + r.ix * size;
    v0 = -1 + r.iy * size;
    double d[3];
    CubeDirection(r.face, u0 + size / 2, v0 + size / 2, d);
    for (int a = 0; a < 3; a++) center[a] = d[a] * Radius;
  }

  VertexSample Sample(double u, double v, int sampleLevel, int sampleGrid) const {
    VertexSample q;
    CubeDirection(r.face, u, v, q.d);
    const double* d = q.d;
    const Aeon::Sample s = TerrainSample(d[0], d[1], d[2], r.seed);
    q.h = s.height; q.rockRelief = s.rockRelief;
    const double step = JsMax(.4, JsMin(200, (2.0 / std::pow(2.0, sampleLevel)) * Radius / sampleGrid * .5));
    double tx = d[2], ty = 0, tz = -d[0];
    double len = JsHypot2(tx, tz);
    if (len < .01) { tx = 1; tz = 0; len = 1; }
    tx /= len; tz /= len;
    const double bx = d[1] * tz, by = d[2] * tx - d[0] * tz, bz = -d[1] * tx;
    const double eps = step / Radius;
    auto heightOffset = [&](double ax, double ay, double az) {
      const double nx = d[0] + ax * eps, ny = d[1] + ay * eps, nz = d[2] + az * eps, l = JsHypot3(nx, ny, nz);
      return TerrainHeight(nx / l, ny / l, nz / l, r.seed);
    };
    const double normalDetail = Smoothstep(2, 7, sampleLevel);
    const double dhT = (heightOffset(tx, ty, tz) - heightOffset(-tx, -ty, -tz)) / (2 * step) * normalDetail;
    const double dhB = (heightOffset(bx, by, bz) - heightOffset(-bx, -by, -bz)) / (2 * step) * normalDetail;
    SurfaceColor(d[0], d[1], d[2], q.h, std::atan(JsHypot2(dhT, dhB)), r.seed, q.color);
    const double nx = d[0] - tx * dhT - bx * dhB, ny = d[1] - ty * dhT - by * dhB, nz = d[2] - tz * dhT - bz * dhB;
    const double nl = JsHypot3(nx, ny, nz);
    q.normal[0] = nx / nl; q.normal[1] = ny / nl; q.normal[2] = nz / nl;
    return q;
  }
};

} // namespace

void BuildPatch(const PatchRequest& r, PatchBuffers& out) {
  const Builder b(r);
  const int grid = r.grid, parentGrid = r.parentGrid;
  const double size = b.size, u0 = b.u0, v0 = b.v0;
  const int count = (grid + 1) * (grid + 1) + 4 * (grid + 1);
  for (int a = 0; a < 3; a++) out.center[a] = b.center[a];
  out.vertexCount = count;
  out.positions.assign(count * 3, 0); out.normals.assign(count * 3, 0); out.colors.assign(count * 3, 0);
  out.directions.assign(count * 3, 0); out.waterPositions.assign(count * 3, 0);
  out.heights.assign(count, 0); out.rockReliefs.assign(count, 0);
  out.indices.clear();

  auto write = [&](int index, double u, double v, double skirt) {
    const VertexSample q = b.Sample(u, v, r.level, grid);
    const int k = index * 3;
    for (int a = 0; a < 3; a++) {
      out.positions[k + a] = static_cast<float>(q.d[a] * (Radius + q.h - skirt) - b.center[a]);
      out.directions[k + a] = static_cast<float>(q.d[a]);
      out.waterPositions[k + a] = static_cast<float>(q.d[a] * (Radius - skirt) - b.center[a]);
      out.normals[k + a] = static_cast<float>(q.normal[a]);
      out.colors[k + a] = static_cast<float>(q.color[a]);
    }
    out.heights[index] = static_cast<float>(q.h);
    out.rockReliefs[index] = static_cast<float>(q.rockRelief);
  };
  for (int j = 0; j <= grid; j++) for (int i = 0; i <= grid; i++) write(j * (grid + 1) + i, u0 + size * i / grid, v0 + size * j / grid, 0);
  for (int j = 0; j < grid; j++) for (int i = 0; i < grid; i++) {
    const int a = j * (grid + 1) + i, bb = a + 1, c = a + grid + 1, d = c + 1;
    const uint16_t tri[6] = {uint16_t(a), uint16_t(bb), uint16_t(c), uint16_t(bb), uint16_t(d), uint16_t(c)};
    out.indices.insert(out.indices.end(), tri, tri + 6);
  }
  std::vector<std::vector<int>> edges(4, std::vector<int>(grid + 1));
  for (int i = 0; i <= grid; i++) { edges[0][i] = i; edges[1][i] = i * (grid + 1) + grid; edges[2][i] = grid * (grid + 1) + grid - i; edges[3][i] = (grid - i) * (grid + 1); }
  int next = (grid + 1) * (grid + 1);
  const double depth = JsMax(4, size * Radius * .045);
  for (const auto& edge : edges) {
    const int start = next;
    for (const int src : edge) { const int i = src % (grid + 1), j = src / (grid + 1); write(next++, u0 + size * i / grid, v0 + size * j / grid, depth); }
    for (int i = 0; i < grid; i++) {
      const uint16_t tri[6] = {uint16_t(edge[i]), uint16_t(start + i), uint16_t(edge[i + 1]), uint16_t(edge[i + 1]), uint16_t(start + i), uint16_t(start + i + 1)};
      out.indices.insert(out.indices.end(), tri, tri + 6);
    }
  }

  // Parent buffers: at level 0 they equal the fine buffers; otherwise each vertex
  // starts on the parent's stored float32 triangles (including its b–c diagonal).
  out.parentPositions = out.positions; out.parentWaterPositions = out.waterPositions;
  out.parentNormals = out.normals; out.parentColors = out.colors; out.parentHeights = out.heights;
  if (r.level > 0) {
    const double parentSize = size * 2, pu0 = -1 + std::floor(r.ix / 2.0) * parentSize, pv0 = -1 + std::floor(r.iy / 2.0) * parentSize;
    double pd[3], parentCenter[3];
    CubeDirection(r.face, pu0 + parentSize / 2, pv0 + parentSize / 2, pd);
    for (int a = 0; a < 3; a++) parentCenter[a] = pd[a] * Radius;
    std::unordered_map<int, VertexSample> cache;
    auto parentVertex = [&](int i, int j) -> const VertexSample& {
      const int key = j * (parentGrid + 1) + i;
      auto it = cache.find(key);
      if (it == cache.end()) {
        VertexSample q = b.Sample(pu0 + parentSize * i / parentGrid, pv0 + parentSize * j / parentGrid, r.level - 1, parentGrid);
        for (int a = 0; a < 3; a++) {
          q.position[a] = Fround(q.d[a] * (Radius + q.h) - parentCenter[a]) + parentCenter[a] - b.center[a];
          q.water[a] = Fround(q.d[a] * Radius - parentCenter[a]) + parentCenter[a] - b.center[a];
          q.normal[a] = Fround(q.normal[a]); q.color[a] = Fround(q.color[a]);
        }
        q.h = Fround(q.h);
        it = cache.emplace(key, q).first;
      }
      return it->second;
    };
    for (int j = 0; j <= grid; j++) for (int i = 0; i <= grid; i++) {
      const double px = (r.ix % 2) * parentGrid / 2.0 + i * parentGrid / (2.0 * grid), py = (r.iy % 2) * parentGrid / 2.0 + j * parentGrid / (2.0 * grid);
      const int x = static_cast<int>(JsMin(parentGrid - 1, std::floor(px))), y = static_cast<int>(JsMin(parentGrid - 1, std::floor(py)));
      const double fx = px - x, fy = py - y;
      struct Term { int x, y; double w; };
      Term t[3];
      if (fx + fy <= 1) { t[0] = {x, y, 1 - fx - fy}; t[1] = {x + 1, y, fx}; t[2] = {x, y + 1, fy}; }
      else { t[0] = {x + 1, y, 1 - fy}; t[1] = {x + 1, y + 1, fx + fy - 1}; t[2] = {x, y + 1, 1 - fx}; }
      const int vertex = j * (grid + 1) + i, k = vertex * 3;
      const VertexSample* q[3] = {&parentVertex(t[0].x, t[0].y), &parentVertex(t[1].x, t[1].y), &parentVertex(t[2].x, t[2].y)};
      // Accumulate in doubles so rounding happens only after interpolation.
      double h = 0; for (int n = 0; n < 3; n++) h = h + q[n]->h * t[n].w;
      out.parentHeights[vertex] = static_cast<float>(h);
      for (int a = 0; a < 3; a++) {
        double p = 0, w = 0, nn = 0, c = 0;
        for (int n = 0; n < 3; n++) { p = p + q[n]->position[a] * t[n].w; w = w + q[n]->water[a] * t[n].w; nn = nn + q[n]->normal[a] * t[n].w; c = c + q[n]->color[a] * t[n].w; }
        out.parentPositions[k + a] = static_cast<float>(p); out.parentWaterPositions[k + a] = static_cast<float>(w);
        out.parentNormals[k + a] = static_cast<float>(nn); out.parentColors[k + a] = static_cast<float>(c);
      }
    }
    int skirt = (grid + 1) * (grid + 1);
    for (const auto& edge : edges) for (const int src : edge) {
      for (int a = 0; a < 3; a++) {
        out.parentPositions[skirt * 3 + a] = static_cast<float>(static_cast<double>(out.parentPositions[src * 3 + a]) - static_cast<double>(out.directions[src * 3 + a]) * depth);
        out.parentWaterPositions[skirt * 3 + a] = static_cast<float>(static_cast<double>(out.parentWaterPositions[src * 3 + a]) - static_cast<double>(out.directions[src * 3 + a]) * depth);
        out.parentNormals[skirt * 3 + a] = out.parentNormals[src * 3 + a]; out.parentColors[skirt * 3 + a] = out.parentColors[src * 3 + a];
      }
      out.parentHeights[skirt] = out.parentHeights[src]; skirt++;
    }
  }
}

}} // namespace StarAgent::Aeon
