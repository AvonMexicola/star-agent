// Ports of fdlibm e_pow.c and e_exp.c (SunPro, 1993). Original notice:
// ====================================================
// Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
// Developed at SunPro, a Sun Microsystems, Inc. business.
// Permission to use, copy, modify, and distribute this
// software is freely granted, provided that this notice
// is preserved.
// ====================================================
// Transcribed from the copy bundled with SDL3 (SDL_gui-backend/src/libm), which
// is the same fdlibm 5.3 lineage V8 uses. Word access uses memcpy instead of the
// original union macros; the arithmetic is unchanged.
#include "JsLibm.h"
#include <cmath>
#include <cstdint>
#include <cstring>

#if defined(__clang__)
#pragma clang fp contract(off)
#endif

namespace StarAgent { namespace Js {
namespace {

inline void ExtractWords(int32_t& hi, uint32_t& lo, double d) { uint64_t u; std::memcpy(&u, &d, 8); hi = static_cast<int32_t>(static_cast<uint32_t>(u >> 32)); lo = static_cast<uint32_t>(u); }
inline int32_t HighWord(double d) { uint64_t u; std::memcpy(&u, &d, 8); return static_cast<int32_t>(static_cast<uint32_t>(u >> 32)); }
inline uint32_t LowWord(double d) { uint64_t u; std::memcpy(&u, &d, 8); return static_cast<uint32_t>(u); }
inline void SetHighWord(double& d, uint32_t hi) { uint64_t u; std::memcpy(&u, &d, 8); u = (static_cast<uint64_t>(hi) << 32) | (u & 0xffffffffull); std::memcpy(&d, &u, 8); }
inline void SetLowWord(double& d, uint32_t lo) { uint64_t u; std::memcpy(&u, &d, 8); u = (u & 0xffffffff00000000ull) | lo; std::memcpy(&d, &u, 8); }

const double
bp[] = {1.0, 1.5,},
dp_h[] = { 0.0, 5.84962487220764160156e-01,},
dp_l[] = { 0.0, 1.35003920212974897128e-08,},
zero    =  0.0,
one     =  1.0,
two     =  2.0,
two53   =  9007199254740992.0,
huge    =  1.0e300,
tiny    =  1.0e-300,
L1  =  5.99999999999994648725e-01,
L2  =  4.28571428578550184252e-01,
L3  =  3.33333329818377432918e-01,
L4  =  2.72728123808534006489e-01,
L5  =  2.30660745775561754067e-01,
L6  =  2.06975017800338417784e-01,
P1   =  1.66666666666666019037e-01,
P2   = -2.77777777770155933842e-03,
P3   =  6.61375632143793436117e-05,
P4   = -1.65339022054652515390e-06,
P5   =  4.13813679705723846039e-08,
lg2  =  6.93147180559945286227e-01,
lg2_h  =  6.93147182464599609375e-01,
lg2_l  = -1.90465429995776804525e-09,
ovt =  8.0085662595372944372e-0017,
cp    =  9.61796693925975554329e-01,
cp_h  =  9.61796700954437255859e-01,
cp_l  = -7.02846165095275826516e-09,
ivln2    =  1.44269504088896338700e+00,
ivln2_h  =  1.44269502162933349609e+00,
ivln2_l  =  1.92596299112661746887e-08;

} // namespace

double Pow(double x, double y) {
  double z, ax, z_h, z_l, p_h, p_l;
  double y1, t1, t2, r, s, t, u, v, w;
  int32_t i, j, k, yisint, n;
  int32_t hx, hy, ix, iy;
  uint32_t lx, ly;

  ExtractWords(hx, lx, x);
  ix = hx & 0x7fffffff;
  ExtractWords(hy, ly, y);
  iy = hy & 0x7fffffff;

  /* y==zero: x**0 = 1 */
  if ((iy | ly) == 0) return one;
  /* x==1: 1**y = 1 */
  if (hx == 0x3ff00000 && lx == 0) return one;
  /* +-NaN return x+y */
  if (ix > 0x7ff00000 || ((ix == 0x7ff00000) && (lx != 0)) ||
      iy > 0x7ff00000 || ((iy == 0x7ff00000) && (ly != 0)))
    return x + y;

  yisint = 0;
  if (hx < 0) {
    if (iy >= 0x43400000) yisint = 2;
    else if (iy >= 0x3ff00000) {
      k = (iy >> 20) - 0x3ff;
      if (k > 20) {
        j = static_cast<int32_t>(ly >> (52 - k));
        if ((static_cast<uint32_t>(j) << (52 - k)) == ly) yisint = 2 - (j & 1);
      } else if (ly == 0) {
        j = iy >> (20 - k);
        if ((j << (20 - k)) == iy) yisint = 2 - (j & 1);
      }
    }
  }

  if (ly == 0) {
    if (iy == 0x7ff00000) {
      if (((ix - 0x3ff00000) | static_cast<int32_t>(lx)) == 0) return one;
      if (ix >= 0x3ff00000) return (hy >= 0) ? y : zero;
      return (hy < 0) ? -y : zero;
    }
    if (iy == 0x3ff00000) { if (hy < 0) return one / x; else return x; }
    if (hy == 0x40000000) return x * x;
    if (hy == 0x3fe00000) { if (hx >= 0) return std::sqrt(x); }
  }

  ax = std::fabs(x);
  if (lx == 0) {
    if (ix == 0x7ff00000 || ix == 0 || ix == 0x3ff00000) {
      z = ax;
      if (hy < 0) z = one / z;
      if (hx < 0) {
        if (((ix - 0x3ff00000) | yisint) == 0) z = (z - z) / (z - z);
        else if (yisint == 1) z = -z;
      }
      return z;
    }
  }

  if ((((static_cast<uint32_t>(hx) >> 31) - 1u) | static_cast<uint32_t>(yisint)) == 0) return (x - x) / (x - x);

  if (iy > 0x41e00000) {
    if (iy > 0x43f00000) {
      if (ix <= 0x3fefffff) return (hy < 0) ? huge * huge : tiny * tiny;
      if (ix >= 0x3ff00000) return (hy > 0) ? huge * huge : tiny * tiny;
    }
    if (ix < 0x3fefffff) return (hy < 0) ? huge * huge : tiny * tiny;
    if (ix > 0x3ff00000) return (hy > 0) ? huge * huge : tiny * tiny;
    t = x - 1;
    w = (t * t) * (0.5 - t * (0.3333333333333333333333 - t * 0.25));
    u = ivln2_h * t;
    v = t * ivln2_l - w * ivln2;
    t1 = u + v;
    SetLowWord(t1, 0);
    t2 = v - (t1 - u);
  } else {
    double s2, s_h, s_l, t_h, t_l;
    n = 0;
    if (ix < 0x00100000) { ax *= two53; n -= 53; ix = HighWord(ax); }
    n += ((ix) >> 20) - 0x3ff;
    j = ix & 0x000fffff;
    ix = j | 0x3ff00000;
    if (j <= 0x3988E) k = 0;
    else if (j < 0xBB67A) k = 1;
    else { k = 0; n += 1; ix -= 0x00100000; }
    SetHighWord(ax, static_cast<uint32_t>(ix));

    u = ax - bp[k];
    v = one / (ax + bp[k]);
    s = u * v;
    s_h = s;
    SetLowWord(s_h, 0);
    t_h = zero;
    SetHighWord(t_h, static_cast<uint32_t>(((ix >> 1) | 0x20000000) + 0x00080000 + (k << 18)));
    t_l = ax - (t_h - bp[k]);
    s_l = v * ((u - s_h * t_h) - s_h * t_l);
    s2 = s * s;
    r = s2 * s2 * (L1 + s2 * (L2 + s2 * (L3 + s2 * (L4 + s2 * (L5 + s2 * L6)))));
    r += s_l * (s_h + s);
    s2 = s_h * s_h;
    t_h = 3.0 + s2 + r;
    SetLowWord(t_h, 0);
    t_l = r - ((t_h - 3.0) - s2);
    u = s_h * t_h;
    v = s_l * t_h + t_l * s;
    p_h = u + v;
    SetLowWord(p_h, 0);
    p_l = v - (p_h - u);
    z_h = cp_h * p_h;
    z_l = cp_l * p_h + p_l * cp + dp_l[k];
    t = static_cast<double>(n);
    t1 = (((z_h + z_l) + dp_h[k]) + t);
    SetLowWord(t1, 0);
    t2 = z_l - (((t1 - t) - dp_h[k]) - z_h);
  }

  s = one;
  if ((((static_cast<uint32_t>(hx) >> 31) - 1u) | static_cast<uint32_t>(yisint - 1)) == 0) s = -one;

  y1 = y;
  SetLowWord(y1, 0);
  p_l = (y - y1) * t1 + y * t2;
  p_h = y1 * t1;
  z = p_l + p_h;
  {
    uint32_t iu;
    ExtractWords(j, iu, z);
    i = static_cast<int32_t>(iu);
  }
  if (j >= 0x40900000) {
    if (((j - 0x40900000) | i) != 0) return s * huge * huge;
    else { if (p_l + ovt > z - p_h) return s * huge * huge; }
  } else if ((j & 0x7fffffff) >= 0x4090cc00) {
    if (((static_cast<uint32_t>(j) - 0xc090cc00u) | static_cast<uint32_t>(i)) != 0) return s * tiny * tiny;
    else { if (p_l <= z - p_h) return s * tiny * tiny; }
  }
  i = j & 0x7fffffff;
  k = (i >> 20) - 0x3ff;
  n = 0;
  if (i > 0x3fe00000) {
    n = j + (0x00100000 >> (k + 1));
    k = ((n & 0x7fffffff) >> 20) - 0x3ff;
    t = zero;
    SetHighWord(t, static_cast<uint32_t>(n & ~(0x000fffff >> k)));
    n = ((n & 0x000fffff) | 0x00100000) >> (20 - k);
    if (j < 0) n = -n;
    p_h -= t;
  }
  t = p_l + p_h;
  SetLowWord(t, 0);
  u = t * lg2_h;
  v = (p_l - (t - p_h)) * lg2 + t * lg2_l;
  z = u + v;
  w = v - (z - u);
  t = z * z;
  t1 = z - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  r = (z * t1) / (t1 - two) - (w + z * w);
  z = one - (r - z);
  j = HighWord(z);
  j = static_cast<int32_t>(static_cast<uint32_t>(j) + (static_cast<uint32_t>(n) << 20));
  if ((j >> 20) <= 0) z = std::scalbn(z, n);
  else SetHighWord(z, static_cast<uint32_t>(j));
  return s * z;
}

namespace {
const double
halF[2] = {0.5, -0.5,},
twom1000 = 9.33263618503218878990e-302,
o_threshold =  7.09782712893383973096e+02,
u_threshold = -7.45133219101941108420e+02,
ln2HI[2] = { 6.93147180369123816490e-01, -6.93147180369123816490e-01,},
ln2LO[2] = { 1.90821492927058770002e-10, -1.90821492927058770002e-10,},
invln2 = 1.44269504088896338700e+00;
} // namespace

double Exp(double x) {
  double y;
  double hi = 0.0;
  double lo = 0.0;
  double c;
  double t;
  int32_t k = 0;
  int32_t xsb;
  uint32_t hx;

  hx = static_cast<uint32_t>(HighWord(x));
  xsb = (hx >> 31) & 1;
  hx &= 0x7fffffff;

  if (hx >= 0x40862E42) {
    if (hx >= 0x7ff00000) {
      uint32_t lx = LowWord(x);
      if (((hx & 0xfffff) | lx) != 0) return x + x;
      else return (xsb == 0) ? x : 0.0;
    }
    if (x > o_threshold) return HUGE_VAL;
    if (x < u_threshold) return twom1000 * twom1000;
  }

  if (hx > 0x3fd62e42) {
    if (hx < 0x3FF0A2B2) {
      hi = x - ln2HI[xsb]; lo = ln2LO[xsb]; k = 1 - xsb - xsb;
    } else {
      k = static_cast<int32_t>(invln2 * x + halF[xsb]);
      t = k;
      hi = x - t * ln2HI[0];
      lo = t * ln2LO[0];
    }
    x = hi - lo;
  } else if (hx < 0x3e300000) {
    if (huge + x > one) return one + x;
  } else k = 0;

  t = x * x;
  c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k == 0) return one - ((x * c) / (c - 2.0) - x);
  else y = one - ((lo - (x * c) / (2.0 - c)) - hi);
  if (k >= -1021) {
    uint32_t hy = static_cast<uint32_t>(HighWord(y));
    SetHighWord(y, hy + (static_cast<uint32_t>(k) << 20));
    return y;
  } else {
    uint32_t hy = static_cast<uint32_t>(HighWord(y));
    SetHighWord(y, hy + (static_cast<uint32_t>(k + 1000) << 20));
    return y * twom1000;
  }
}

}} // namespace StarAgent::Js
