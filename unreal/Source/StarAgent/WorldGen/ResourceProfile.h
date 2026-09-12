// C++ port of src/resource-profile.js: the composition contract shared by
// geography, colour and surveys. Body samplers supply abundances; this never
// invents deposits. Engine-free.
#pragma once

namespace StarAgent { namespace Resource {

constexpr int MaxIds = 8;

struct Profile {
  int count;                 // number of resource ids (3 for Pyre and Miasma)
  double weights[MaxIds];    // abundance / total, same order as the body's id list
  int dominant;              // index of the largest weight (first on ties)
};

// resourceProfile(ids, abundances, province) minus the id strings and province,
// which the caller keeps. Abundances must be finite and non-negative with a
// positive total; the JavaScript throws otherwise, here the result is unspecified.
Profile MakeProfile(const double* abundances, int count);

// resourceColor(profile, palette): linear RGB weighted by the profile.
// `palette[i]` is the colour of id i in the body's id order.
void ProfileColor(const Profile& profile, const double (*palette)[3], double outRgb[3]);

}} // namespace StarAgent::Resource
