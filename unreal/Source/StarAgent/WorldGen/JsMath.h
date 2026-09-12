// ECMAScript numeric semantics for the world-generation ports.
//
// The browser generators are the reference for every seeded world. To
// reproduce them bit for bit in C++ the integer conversions, min/max and
// Math.hypot must behave exactly as V8 does. Every WorldGen/*.cpp uses these
// instead of the std:: equivalents. Header-only; no Unreal dependencies.
#pragma once
#include <cmath>
#include <cstdint>

#if defined(__clang__)
#pragma clang fp contract(off)
#endif

namespace StarAgent { namespace Js {

constexpr double JsPi = 3.141592653589793;  // Math.JsPi (named to avoid Unreal's JsPi macro)

// ToInt32/ToUint32: truncate toward zero, then modulo 2^32. Same bit pattern
// either way, so one unsigned helper serves both `x | 0` and `>>> 0`.
inline uint32_t ToUint32(double v) {
  if (v > -9.0e18 && v < 9.0e18) return static_cast<uint32_t>(static_cast<uint64_t>(static_cast<int64_t>(v)));
  if (!(v == v) || v == HUGE_VAL || v == -HUGE_VAL) return 0u;
  double t = std::trunc(v);
  t = std::fmod(t, 4294967296.0);
  if (t < 0) t += 4294967296.0;
  return static_cast<uint32_t>(t);
}

// Math.imul(a, b): wrapping 32-bit multiply; the result bits are the same
// whether read as int32 (JavaScript) or uint32 (here).
inline uint32_t Imul(double a, double b) { return ToUint32(a) * ToUint32(b); }

// Math.max / Math.min: NaN propagates, +0 beats -0 for max and -0 beats +0 for min.
inline double JsMax(double a, double b) {
  if (a != a) return a;
  if (b != b) return b;
  if (a > b) return a;
  if (b > a) return b;
  return std::signbit(a) ? b : a;  // equal, possibly +0 vs -0
}
inline double JsMin(double a, double b) {
  if (a != a) return a;
  if (b != b) return b;
  if (a < b) return a;
  if (b < a) return b;
  return std::signbit(a) ? a : b;
}

// Math.hypot as V8 implements it (builtins math.tq MathHypot): scale by the
// largest magnitude, Kahan-summed squares, sqrt, rescale. std::hypot rounds
// differently in the last bit.
inline double JsHypot(const double* v, int n) {
  double max = 0;
  bool nan = false;
  for (int i = 0; i < n; i++) {
    const double a = std::fabs(v[i]);
    if (a == HUGE_VAL) return HUGE_VAL;
    if (a != a) nan = true; else if (a > max) max = a;
  }
  if (nan) return NAN;
  if (max == 0) return 0;
  double sum = 0, compensation = 0;
  for (int i = 0; i < n; i++) {
    const double nrm = std::fabs(v[i]) / max;
    const double summand = nrm * nrm - compensation;
    const double preliminary = sum + summand;
    compensation = (preliminary - sum) - summand;
    sum = preliminary;
  }
  return std::sqrt(sum) * max;
}
inline double JsHypot2(double a, double b) { const double v[2] = {a, b}; return JsHypot(v, 2); }
inline double JsHypot3(double a, double b, double c) { const double v[3] = {a, b, c}; return JsHypot(v, 3); }

// Three.js Vector3.length()/normalize() use sqrt(x*x+y*y+z*z), NOT Math.hypot.
inline double ThreeLength(double x, double y, double z) { return std::sqrt(x * x + y * y + z * z); }

// Math.fround: round a double to the nearest float32 and back.
inline double Fround(double v) { return static_cast<double>(static_cast<float>(v)); }

}} // namespace StarAgent::Js
