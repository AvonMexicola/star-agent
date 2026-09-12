// V8's Math.pow / ** and Math.exp, bit for bit.
//
// V8 evaluates Math.pow and Math.exp with fdlibm-derived code (src/base/ieee754.cc),
// while glibc's pow/exp are correctly rounded. They differ in the last bit for
// roughly 10% of inputs (measured on this machine: 19,939 of 200,000 for
// pow(x,6), 19,659 for exp). Miasma's `ridge ** 6` and every crater/basin rim
// use these, so the generators call Js::Pow / Js::Exp instead of std::.
// sin/cos/atan2/acos are NOT ported; their residual (1 ulp) is reported by the
// cross-checks and only reaches volcano flanks and constant feature directions.
#pragma once

namespace StarAgent { namespace Js {

double Pow(double x, double y);  // fdlibm __ieee754_pow
double Exp(double x);            // fdlibm __ieee754_exp

}} // namespace StarAgent::Js
