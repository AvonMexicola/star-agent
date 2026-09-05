import * as THREE from 'three';
import { RADIUS } from './world.js';

/** Metres above the datum surface. Peaks reach ~4,200 m, so the highlands really
 * do stand above this deck. */
export const CLOUD_ALTITUDE = 2_800;
/** Nominal vertical extent. Only used for the fly-through fade: the shell itself
 * is infinitely thin, so we dissolve it while the camera crosses the layer. */
export const CLOUD_THICKNESS = 600;

const SHELL_RADIUS = RADIUS + CLOUD_ALTITUDE;

// Camera-relative rendering: the shell's world centre is the planet centre, so
// mesh.position is simply -renderOrigin. A 1.6e6 m sphere in float32 vertices
// carries ~0.13 m of positional error, which is invisible for a cloud deck.
const vertexShader = `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vShellNormal;
  varying vec3 vWorld;
  void main(){
    vShellNormal=normal;
    vec4 world=modelMatrix*vec4(position,1.0);
    vWorld=world.xyz;
    gl_Position=projectionMatrix*viewMatrix*world;
    #include <logdepthbuf_vertex>
  }
`;

// Coverage is a band-limited noise field evaluated directly on the unit sphere
// normal, so there is no seam and no texture to load. Anisotropy comes from
// squashing the field along the polar axis, which stretches every cell
// east-west into trade-wind streaks.
const fragmentShader = `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 sunDirection;
  uniform float time;
  uniform float cameraDistance;
  uniform float altitude;
  uniform float density;
  varying vec3 vShellNormal;
  varying vec3 vWorld;

  const float SHELL_RADIUS=${SHELL_RADIUS.toFixed(1)};
  const float THICKNESS=${CLOUD_THICKNESS.toFixed(1)};
  const float FAR_NEAR=${(RADIUS * 6.0).toFixed(1)};
  const float FAR_FULL=${(RADIUS * 11.0).toFixed(1)};
  // Ambient skylight reaching a cloud base. Linear HDR, pre-tonemap.
  const vec3 SKY=vec3(0.55,0.62,0.72);
  // Value noise has an axis-aligned lattice, which shows up as stair-stepped
  // cloud edges at high frequency. Tilting the two detail bands off the sphere's
  // own axes hides it. Rotation of 0.6 rad about Y then 0.45 rad about X.
  const mat3 TILT=mat3(0.8253,0.2456,-0.5084,0.0,0.9004,0.4350,0.5646,-0.3590,0.7431);

  float hash31(vec3 p){
    p=fract(p*0.3183099+vec3(0.71,0.113,0.419));
    p*=17.0;
    return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
  }
  float vnoise(vec3 x){
    vec3 i=floor(x),f=fract(x);
    f=f*f*(3.0-2.0*f);
    float a=mix(hash31(i),hash31(i+vec3(1.0,0.0,0.0)),f.x);
    float b=mix(hash31(i+vec3(0.0,1.0,0.0)),hash31(i+vec3(1.0,1.0,0.0)),f.x);
    float c=mix(hash31(i+vec3(0.0,0.0,1.0)),hash31(i+vec3(1.0,0.0,1.0)),f.x);
    float d=mix(hash31(i+vec3(0.0,1.0,1.0)),hash31(i+vec3(1.0,1.0,1.0)),f.x);
    return mix(mix(a,b,f.y),mix(c,d,f.y),f.z);
  }
  float fbm4(vec3 p){
    float sum=0.0,amp=0.5,norm=0.0;
    for(int i=0;i<4;i++){sum+=amp*vnoise(p);norm+=amp;p=p*2.09+vec3(19.3,7.1,-11.7);amp*=0.5;}
    return sum/norm;
  }
  float fbm3(vec3 p){
    float sum=0.0,amp=0.5,norm=0.0;
    for(int i=0;i<3;i++){sum+=amp*vnoise(p);norm+=amp;p=p*2.13+vec3(5.7,-3.9,13.1);amp*=0.5;}
    return sum/norm;
  }
  float fbm2(vec3 p){
    return (vnoise(p)*2.0+vnoise(p*2.11+vec3(31.7,-8.3,4.9)))/3.0;
  }

  void main(){
    #include <logdepthbuf_fragment>
    vec3 n=normalize(vShellNormal);
    // Safe normalise: the camera can sit exactly on the shell while crossing it,
    // and a NaN here would survive the alpha test below.
    vec3 toCamera=cameraPosition-vWorld;
    float range=length(toCamera);
    vec3 view=toCamera/max(range,1.0e-4);

    // How obliquely we cut the deck. Toward the horizon the slant path through
    // the layer grows as 1/cos, which is what turns a broken deck into a solid
    // grey band. The 0.03 floor keeps the exponential below.
    float grazing=clamp(abs(dot(view,n)),0.03,1.0);
    // At those angles one screen pixel spans kilometres of cloud, so the detail
    // bands stop being detail and start being aliased slivers. Retire them.
    float slant=smoothstep(0.08,0.30,grazing);

    // Tangent frame. cross() collapses at the poles, so fall back explicitly
    // rather than normalising a zero vector into NaNs.
    vec3 east=cross(vec3(0.0,1.0,0.0),n);
    float eastLength=length(east);
    east=mix(vec3(1.0,0.0,0.0),east/max(eastLength,1.0e-4),step(1.0e-4,eastLength));
    vec3 north=cross(n,east);

    // Alternating wind belts: roughly five bands from pole to pole, ~22 m/s,
    // so a cell drifts about 1.3 km per minute. Visible, never distracting.
    // An exact rotation in the (n, east) plane, so it never saturates or drifts
    // off the sphere however long the session runs.
    float belt=cos(n.y*7.5);
    float spin=time*22.0*belt/SHELL_RADIUS;
    vec3 flow=n*cos(spin)+east*sin(spin);

    // Continental-scale domain warp (~88 km of tangential displacement) turns
    // the isotropic field into swirls and frontal hooks, and slowly reorganises.
    vec3 warpPoint=flow*3.4+vec3(0.0,0.0,time*0.0012);
    float w1=vnoise(warpPoint);
    float w2=vnoise(warpPoint+vec3(41.7,17.3,29.1));
    vec3 warped=normalize(flow+(east*(w1-0.5)+north*(w2-0.5))*0.055);

    // Band 1, the carrier. Squashing y stretches cells 2.5x along longitude:
    // ~75 km wide, ~30 km tall, breaking down to ~10 km.
    float coverage=fbm4(vec3(warped.x,warped.y*2.5,warped.z)*21.0);
    // Band 2 breaks those cells into ~23 km lumps; visible from orbit.
    float mid=fbm2(TILT*vec3(warped.x,warped.y*1.9,warped.z)*70.0);
    coverage+=(mid-0.5)*0.22*slant;
    // Band 3, ~5 km down to ~1.2 km, is what you see from underneath the deck.
    // altitude is SIGNED, so abs() switches this on below the shell too.
    float detailWeight=(1.0-smoothstep(20000.0,150000.0,abs(altitude)))*slant;
    float fine=0.5;
    if(detailWeight>0.01){
      fine=fbm3(TILT*vec3(warped.x,warped.y*1.5,warped.z)*340.0);
      coverage+=(fine-0.5)*0.24*detailWeight;
    }

    // Continent-sized weather systems: whole regions stay clear while others
    // fill in. Without this the globe reads as uniform speckle.
    // The offset is a seed, chosen so the five quick-transit destinations do not
    // all land in the same dead-clear region; it does not change the statistics.
    float weather=fbm3(vec3(warped.x,warped.y*1.35,warped.z)*2.6+vec3(31.0,7.0,13.0));
    float threshold=mix(0.608,0.423,smoothstep(0.34,0.66,weather));
    // density is a FINE TRIM on coverage, not an opacity multiplier: turning it
    // down thins the sky rather than leaving ghostly half-transparent clouds,
    // and it deliberately has little authority so no caller can wipe the sky out
    // or whiten the planet. Across its whole 0..2 range coverage stays inside
    // 32-45%; change the two thresholds above for anything bigger.
    threshold+=(1.0-clamp(density,0.0,2.0))*0.025;

    float polar=mix(1.0,0.6,smoothstep(0.83,0.92,abs(n.y)));
    // A wide feather plus a falloff on the thin end: fluffy silhouettes instead
    // of vector-sharp cut-outs.
    // Widen the mask enormously at extreme grazing: a sight line that skims the
    // deck crosses cloud AND gap over its ~12 km slant path, so what it should
    // return is the local average, not a hard in/out. Widened about the midpoint
    // so the 50% coverage level -- and therefore the statistics -- do not move.
    float sharp=mix(0.13,0.17,detailWeight);
    float feather=mix(0.55,sharp,slant);
    float midPoint=threshold+sharp*0.5;
    float thickness=smoothstep(midPoint-feather*0.5,midPoint+feather*0.5,coverage);
    // Beer's law over the slant path. 1.86 is chosen so a solid cell seen
    // face-on lands at alpha 0.845 -- land and sky still tint through overhead --
    // while the same cell at the horizon goes smoothly opaque instead of
    // breaking into hard slabs with sky slivers between them.
    float opticalDepth=thickness*smoothstep(0.0,0.35,thickness)*polar*1.86;
    float alpha=1.0-exp(-opticalDepth/grazing);

    // Dissolve while flying through the deck; thin out at extreme range so the
    // planet never reads as a white ball.
    alpha*=smoothstep(0.0,THICKNESS*0.75,abs(cameraDistance-SHELL_RADIUS));
    alpha*=mix(1.0,0.85,smoothstep(FAR_NEAR,FAR_FULL,cameraDistance));
    // The atmosphere pass replaces every far-depth pixel with stars, so anything
    // we keep must write depth and everything else must vanish before that.
    if(alpha<0.02)discard;

    float ndl=dot(n,sunDirection);
    float day=smoothstep(-0.30,0.12,ndl);
    float lit=smoothstep(-0.25,0.35,ndl);
    float wrap=clamp(ndl*0.6+0.4,0.0,1.0);
    // Which face of the deck are we looking at? On a sphere dot(view,n) is never
    // negative for the visible side, so it cannot answer this on its own; the
    // camera's own side of the shell does, and dot() only softens the limb where
    // the layer really is seen edge-on.
    float aboveDeck=smoothstep(-600.0,600.0,altitude);
    float fromAbove=mix(0.5,aboveDeck,smoothstep(0.0,0.55,abs(dot(view,n))));

    // Direct sun lands on the tops. The base is lit by the whole sky dome, which
    // is what keeps an overcast underside light grey rather than navy.
    vec3 color=vec3(1.05,1.03,0.99)*lit*mix(0.24,0.85,fromAbove);
    color+=SKY*day*mix(0.92,0.30,fromAbove);
    color+=SKY*wrap*day*0.18;
    // Deep cloud lets less skylight through to its base.
    color*=mix(1.0,0.80,thickness*(1.0-fromAbove));
    // Break up the flat plate with the same noise that shapes the silhouette.
    float mottle=(mid-0.5)*0.55*slant+(fine-0.5)*detailWeight;
    // Within ~20 km, one extra ~500 m octave keeps an overcast base from reading
    // as a painted ceiling. Faded out by range so the horizon cannot shimmer.
    float nearDeck=(1.0-smoothstep(6000.0,20000.0,range))*slant;
    if(nearDeck>0.01)mottle+=(vnoise(TILT*warped*3000.0)-0.5)*1.3*nearDeck;
    color*=1.0+mottle*0.5;
    color=mix(color,color*vec3(1.22,0.94,0.74),(1.0-smoothstep(0.02,0.40,abs(ndl)))*0.7);

    // Forward scattering: thin edges glow when the sun sits beyond them.
    float forward=max(dot(-view,sunDirection),0.0);
    color+=vec3(1.0,0.95,0.86)*pow(forward,9.0)*(1.0-thickness)*lit*0.7;
    color+=vec3(0.008,0.010,0.016)*(1.0-day);

    // Near the horizon most of the sight line is air, not cloud, so the deck has
    // to settle into the haze instead of staying a bright white wall.
    float hazeAmount=(1.0-slant)*smoothstep(12000.0,60000.0,range)*0.8;
    color=mix(color,SKY*(0.72+0.38*lit)*day+vec3(0.010,0.012,0.018)*(1.0-day),hazeAmount);

    gl_FragColor=vec4(color,alpha);
  }
`;

/** A single-draw-call animated cloud deck: one sphere shell, one fragment shader,
 * no ray marching and no textures. */
export class Clouds {
  constructor(scene) {
    this.scene = scene;
    this.geometry = new THREE.SphereGeometry(SHELL_RADIUS, 192, 96);
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        sunDirection: { value: new THREE.Vector3(0, 0, 1) },
        time: { value: 0 },
        // Camera distance from the planet centre, metres.
        cameraDistance: { value: SHELL_RADIUS * 3 },
        // Signed camera height above the shell, metres. Negative below it.
        altitude: { value: RADIUS },
        density: { value: 1 },
      },
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'Procedural cloud shell';
    // The camera lives inside or beside the bounding sphere at all times, and the
    // origin rebases every frame, so aggregate culling can only get this wrong.
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  /** Zero allocations per frame. Call before the atmosphere post pass. */
  update(worldPosition, renderOrigin, sunDirection, elapsedSeconds) {
    this.mesh.position.copy(renderOrigin).negate();
    const distance = worldPosition.length();
    const uniforms = this.material.uniforms;
    uniforms.cameraDistance.value = distance;
    uniforms.altitude.value = distance - SHELL_RADIUS;
    uniforms.sunDirection.value.copy(sunDirection);
    uniforms.time.value = elapsedSeconds;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
