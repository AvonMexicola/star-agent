#include "ResourceProfile.h"
#include "JsMath.h"

namespace StarAgent { namespace Resource {

Profile MakeProfile(const double* abundances, int count) {
  Profile p;
  p.count = count;
  // abundances.reduce((a, b) => a + b, 0)
  double total = 0;
  for (int i = 0; i < count; i++) total = total + abundances[i];
  for (int i = 0; i < count; i++) p.weights[i] = abundances[i] / total;
  // weights.indexOf(Math.max(...weights))
  double max = p.weights[0];
  for (int i = 1; i < count; i++) max = Js::JsMax(max, p.weights[i]);
  p.dominant = 0;
  for (int i = 0; i < count; i++) if (p.weights[i] == max) { p.dominant = i; break; }
  return p;
}

void ProfileColor(const Profile& profile, const double (*palette)[3], double out[3]) {
  for (int axis = 0; axis < 3; axis++) {
    double sum = 0;
    for (int i = 0; i < profile.count; i++) sum = sum + palette[i][axis] * profile.weights[i];
    out[axis] = sum;
  }
}

}} // namespace StarAgent::Resource
