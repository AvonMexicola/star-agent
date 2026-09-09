# Station wheel collision

The user reports colliding while visible wheel geometry leaves ample room.
The actual authored ring reproduces a hit through ring-local X -160 to +160 at
Y 692.820323 / Z 400: even a 200 m square corridor contains no visible triangles.
Long diagonal spoke triangle bounding boxes are treated as the final collision.

Retain the local BVH broad phase and perform continuous box/triangle SAT at its
leaves. Keep real spoke/rim/door collisions, body envelopes, local rotation/rebase,
server authority and the existing authored assets. No endpoint-only sampling or
whole-ring enclosing collider. Add actual-asset gap/solid/rotation/fast-sweep
regressions plus the real controller flight through the wheel from the supported
exterior inspection launch. Check allocation/query costs against the old tree.

Own fix/station-wheel-collision from c5eb519; src/station-collision.js, station
tests, the bounded browser harness and these records. Private preview 5700,
one browser only after the shared GPU inventory. Local integration is authorized;
the separately pending public release remains subject to its GitHub billing gate.
