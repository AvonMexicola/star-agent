"""Creates the Star Agent terrain material in the open editor.

Run from the editor's Output Log command line in Python mode (enter the path
only), or in Cmd mode prefixed with `py`:
    /home/cees/projects/star-agent-unreal/unreal/Scripts/create_materials.py

Builds /Game/StarAgent/Materials/M_AeonLand from scratch (the old asset is
deleted first when the editor lets us; otherwise nodes are appended and the
new ones win). APlanetActor loads it by path at BeginPlay.

Graph:
  * TerrainGeomorph (custom HLSL): after a split the children slide from the
    parent surface (UV3..UV7) to their own over MorphSeconds; drives World
    Position Offset and a world-space Normal. terrain-lod.js in the browser.
  * SurfaceShade (custom HLSL): terrain-v2.js surfaceColor() evaluated PER
    PIXEL from interpolated height (UV0.x), the pixel normal (slope), and the
    baked moisture / noise maps (OrbitalAlbedo.a, OrbitalFields.rg), so
    snowlines and rock are gradients instead of per-vertex blobs. Beyond
    AlbedoFadeNearKm it blends to the baked albedo map (OrbitalAlbedo.rgb).
    Until the planet actor has baked the maps (AlbedoReady) it shows the
    morphed vertex colour.
Pin names: the first output of most nodes has an EMPTY name; "RGB" does not match.
"""
import unreal

FOLDER = '/Game/StarAgent/Materials'
NAME = 'M_AeonLand'
PATH = FOLDER + '/' + NAME

mel = unreal.MaterialEditingLibrary
lib = unreal.EditorAssetLibrary
ok = True


def connect(expression, output_names, prop, label):
    global ok
    for name in output_names:
        if mel.connect_material_property(expression, name, prop):
            unreal.log('create_materials: connected %s via output "%s"' % (label, name))
            return True
    unreal.log_error('create_materials: could NOT connect %s (tried %s)' % (label, output_names))
    ok = False
    return False


def wire(src, src_output, dst, dst_input):
    global ok
    if mel.connect_material_expressions(src, src_output, dst, dst_input):
        return True
    unreal.log_error('create_materials: could NOT connect %s.%s -> %s.%s' % (src.get_class().get_name(), src_output, dst.get_editor_property('description') or dst.get_class().get_name(), dst_input))
    ok = False
    return False


def node(cls, x, y, **props):
    n = mel.create_material_expression(material, cls, x, y)
    for key, value in props.items():
        n.set_editor_property(key, value)
    return n


def custom(description, code, inputs, x, y, extra_outputs=()):
    n = node(unreal.MaterialExpressionCustom, x, y, code=code, description=description,
             output_type=unreal.CustomMaterialOutputType.CMOT_FLOAT3)
    ins = []
    for name in inputs:
        ci = unreal.CustomInput()
        ci.set_editor_property('input_name', name)
        ins.append(ci)
    n.set_editor_property('inputs', ins)
    outs = []
    for name in extra_outputs:
        co = unreal.CustomOutput()
        co.set_editor_property('output_name', name)
        co.set_editor_property('output_type', unreal.CustomMaterialOutputType.CMOT_FLOAT3)
        outs.append(co)
    n.set_editor_property('additional_outputs', outs)
    return n


# --- asset ----------------------------------------------------------------
if lib.does_asset_exist(PATH):
    if lib.delete_asset(PATH):
        unreal.log('create_materials: deleted old %s' % PATH)
    else:
        unreal.log_warning('create_materials: could not delete %s (still referenced?); appending nodes' % PATH)
if lib.does_asset_exist(PATH):
    material = lib.load_asset(PATH)
else:
    material = unreal.AssetToolsHelpers.get_asset_tools().create_asset(NAME, FOLDER, unreal.Material, unreal.MaterialFactoryNew())
    unreal.log('create_materials: created %s' % PATH)

# --- shared inputs ----------------------------------------------------------
default_tex = unreal.load_asset('/Engine/EngineResources/DefaultTexture')
albedo = node(unreal.MaterialExpressionTextureObjectParameter, -1400, -600, parameter_name='OrbitalAlbedo', texture=default_tex)
fields = node(unreal.MaterialExpressionTextureObjectParameter, -1400, -500, parameter_name='OrbitalFields', texture=default_tex)
uv = [node(unreal.MaterialExpressionTextureCoordinate, -1400, -400 + i * 60, coordinate_index=i) for i in range(8)]
pixel_normal = node(unreal.MaterialExpressionPixelNormalWS, -1400, 100)
vertex_normal = node(unreal.MaterialExpressionVertexNormalWS, -1400, 160)
vertex_color = node(unreal.MaterialExpressionVertexColor, -1400, 220)
world_pos = node(unreal.MaterialExpressionWorldPosition, -1400, 280)
cam_pos = node(unreal.MaterialExpressionCameraPositionWS, -1400, 340)
ready = node(unreal.MaterialExpressionScalarParameter, -1400, 420, parameter_name='AlbedoReady', default_value=0.0)
fade_near = node(unreal.MaterialExpressionScalarParameter, -1400, 480, parameter_name='AlbedoFadeNearKm', default_value=40.0)
fade_far = node(unreal.MaterialExpressionScalarParameter, -1400, 540, parameter_name='AlbedoFadeFarKm', default_value=150.0)
morph_param = node(unreal.MaterialExpressionScalarParameter, -1400, 600, parameter_name='TerrainMorph', default_value=1.0)

# --- geomorph ---------------------------------------------------------------
MORPH_HLSL = """
float m = saturate(Morph);
float3 dp = float3(UV3.x, UV3.y, UV4.x);   // parent position - own position, cm
float3 pn = float3(UV4.y, UV5.x, UV5.y);   // parent normal, world frame
float3 pc = float3(UV6.x, UV6.y, UV7.x);   // parent linear colour
MorphNormal = normalize(lerp(pn, VN, m));
MorphColor = lerp(pc, VC, m);
return dp * (1.0 - m);                      // world position offset
"""
geomorph = custom('TerrainGeomorph', MORPH_HLSL, ['Morph', 'UV3', 'UV4', 'UV5', 'UV6', 'UV7', 'VN', 'VC'], -800, 500, ('MorphNormal', 'MorphColor'))
wire(morph_param, '', geomorph, 'Morph')
for i in range(3, 8):
    wire(uv[i], '', geomorph, 'UV%d' % i)
wire(vertex_normal, '', geomorph, 'VN')
wire(vertex_color, '', geomorph, 'VC')
connect(geomorph, [''], unreal.MaterialProperty.MP_WORLD_POSITION_OFFSET, 'TerrainGeomorph -> World Position Offset')
connect(geomorph, ['MorphNormal'], unreal.MaterialProperty.MP_NORMAL, 'TerrainGeomorph.MorphNormal -> Normal')
material.set_editor_property('tangent_space_normal', False)

# --- per-pixel surface colour (terrain-v2.js surfaceColor) ---------------------
SHADE_HLSL = """
float3 d = normalize(float3(UV1.x, UV1.y, UV2.x));              // browser frame, y up
float2 uv = float2(atan2(d.x, d.z) / (2.0 * PI) + 0.5, 0.5 - asin(clamp(d.y, -1.0, 1.0)) / PI);
float4 farTex = Texture2DSample(Tex, TexSampler, uv);             // rgb albedo, a moisture
float2 f = Texture2DSample(Fields, FieldsSampler, uv).rg;         // colour noise, scree noise
float m = farTex.a, n = f.x, fine = f.y;
float h = UV0.x;                                                  // terrain height, metres
float3 radial = normalize(float3(d.x, d.z, d.y));                 // browser (x,y,z) -> Unreal (x,z,y)
float slope = acos(saturate(dot(normalize(N), radial)));
float a = abs(d.y);
float3 c;
if (h < 0.0) {
    float deep = smoothstep(-40.0, -2.0, h);
    c = float3(0.055 + 0.20 * deep, 0.095 + 0.19 * deep, 0.105 + 0.11 * deep);
} else if (h < 4.0) {
    float wet = 1.0 - smoothstep(0.2, 1.5, h);
    c = float3(0.44 - 0.19 * wet, 0.395 - 0.185 * wet, 0.255 - 0.115 * wet);
} else {
    float green = smoothstep(0.39, 0.60, m);
    c = lerp(float3(0.235, 0.225, 0.105), float3(0.055, 0.115, 0.045), green);
    float sandy = (1.0 - smoothstep(4.0, 22.0, h)) * (1.0 - green * 0.7);
    c = lerp(c, float3(0.44, 0.395, 0.255), sandy);
    float alpine = smoothstep(1900.0, 3100.0, h);
    c = lerp(c, float3(0.27, 0.255, 0.225), alpine);
}
float rock = smoothstep(0.52, 0.72, slope) * (h > -6.0 ? 1.0 : 0.0);
float warm = (n - 0.5) * 2.0;
float3 rockColor = float3(0.235 + warm * 0.045, 0.222 + warm * 0.018, 0.212 - warm * 0.03);
float scree = smoothstep(0.34, 0.50, slope) * (1.0 - smoothstep(0.52, 0.66, slope)) * smoothstep(0.45, 0.75, fine);
c = lerp(c, float3(0.30, 0.285, 0.255), scree * 0.75);
c = lerp(c, rockColor, rock);
float snowline = 3500.0 - 3900.0 * smoothstep(0.25, 0.94, a);
float snow = smoothstep(snowline, snowline + 550.0 + (n - 0.5) * 260.0, h) * (1.0 - smoothstep(0.62, 0.86, slope)) * (h > 0.0 ? 1.0 : 0.0);
float ice = max(snow, smoothstep(0.815, 0.885, a + (n - 0.5) * 0.02) * (h > -1.0 ? 1.0 : 0.0));
float variation = 0.88 + n * 0.24;
float3 nearColor = saturate(c * variation * (1.0 - ice) + float3(0.79, 0.86, 0.90) * ice);
float km = distance(WP, Cam) * 1e-5;
float w = smoothstep(FadeNear, FadeFar, km);
return Ready > 0.5 ? lerp(nearColor, farTex.rgb, w) : VC;
"""
shade = custom('SurfaceShade', SHADE_HLSL, ['Tex', 'Fields', 'UV0', 'UV1', 'UV2', 'N', 'WP', 'Cam', 'Ready', 'FadeNear', 'FadeFar', 'VC'], -800, -300)
wire(albedo, '', shade, 'Tex')
wire(fields, '', shade, 'Fields')
for i in range(3):
    wire(uv[i], '', shade, 'UV%d' % i)
wire(pixel_normal, '', shade, 'N')
wire(world_pos, '', shade, 'WP')
wire(cam_pos, '', shade, 'Cam')
wire(ready, '', shade, 'Ready')
wire(fade_near, '', shade, 'FadeNear')
wire(fade_far, '', shade, 'FadeFar')
wire(geomorph, 'MorphColor', shade, 'VC')
connect(shade, [''], unreal.MaterialProperty.MP_BASE_COLOR, 'SurfaceShade -> Base Color')

roughness = node(unreal.MaterialExpressionConstant, -800, -100, r=0.96)
connect(roughness, [''], unreal.MaterialProperty.MP_ROUGHNESS, 'Constant 0.96 -> Roughness')

# Winding is corrected per triangle in PlanetPatchMesh; two-sided is cheap
# insurance on terrain.
material.set_editor_property('two_sided', True)

mel.recompile_material(material)
lib.save_asset(PATH)
unreal.log('create_materials: saved %s; expressions=%d; all connections ok=%s'
           % (PATH, mel.get_num_material_expressions(material), ok))


def fresh_material(name):
    """Delete-and-recreate helper for the extra materials."""
    path = FOLDER + '/' + name
    if lib.does_asset_exist(path) and not lib.delete_asset(path):
        unreal.log_warning('create_materials: could not delete %s; appending nodes' % path)
    if lib.does_asset_exist(path):
        return lib.load_asset(path), path
    return unreal.AssetToolsHelpers.get_asset_tools().create_asset(name, FOLDER, unreal.Material, unreal.MaterialFactoryNew()), path


# =============================== M_AeonWater ===================================
# Single Layer Water over the sea-level mesh (water.js). The shading model
# reads the sea floor's depth behind the surface for absorption and scattering,
# so shore depth needs no extra data. Waves: two octaves of quintic value noise
# in the stable per-vertex coordinates (UV5/UV6, metres), gradient bent into
# the tangent plane, as the browser shader does.
material, PATH = fresh_material('M_AeonWater')
material.set_editor_property('shading_model', unreal.MaterialShadingModel.MSM_SINGLE_LAYER_WATER)
material.set_editor_property('tangent_space_normal', False)
material.set_editor_property('two_sided', False)

w_uv = [node(unreal.MaterialExpressionTextureCoordinate, -1400, -400 + i * 60, coordinate_index=i) for i in range(7)]
w_time = node(unreal.MaterialExpressionTime, -1400, 100)
w_morph = node(unreal.MaterialExpressionScalarParameter, -1400, 160, parameter_name='TerrainMorph', default_value=1.0)
w_amp = node(unreal.MaterialExpressionScalarParameter, -1400, 220, parameter_name='WaveStrength', default_value=0.35)

WATER_MORPH_HLSL = """
float m = saturate(Morph);
return float3(UV3.x, UV3.y, UV4.x) * (1.0 - m);
"""
w_geo = custom('WaterGeomorph', WATER_MORPH_HLSL, ['Morph', 'UV3', 'UV4'], -800, 300)
wire(w_morph, '', w_geo, 'Morph'); wire(w_uv[3], '', w_geo, 'UV3'); wire(w_uv[4], '', w_geo, 'UV4')
connect(w_geo, [''], unreal.MaterialProperty.MP_WORLD_POSITION_OFFSET, 'WaterGeomorph -> World Position Offset')

WAVE_HLSL = """
// Nonperiodic quintic value noise with analytic gradient (water.js field()).
float3 d = normalize(float3(UV1.x, UV1.y, UV2.x));
float3 radial = normalize(float3(d.x, d.z, d.y));           // Unreal frame
float3 p = float3(UV5.x, UV5.y, UV6.x);                      // metres, stable
float3 grad = 0;
float amp = 1.0, freq = 0.45, t = Time;
for (int o = 0; o < 2; o++) {
    float3 q = p * freq + float3(t * 0.35, -t * 0.2, t * 0.27) * (o + 1);
    float3 i = floor(q), f = frac(q);
    float3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float3 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
    #define H(o3) frac(sin(dot(i + o3, float3(127.1, 311.7, 74.7))) * 43758.5453)
    float a = H(float3(0,0,0)), b = H(float3(1,0,0)), c = H(float3(0,1,0)), e = H(float3(1,1,0));
    float g = H(float3(0,0,1)), h = H(float3(1,0,1)), j = H(float3(0,1,1)), k = H(float3(1,1,1));
    #undef H
    float lo = lerp(lerp(a, b, u.x), lerp(c, e, u.x), u.y);
    float hi = lerp(lerp(g, h, u.x), lerp(j, k, u.x), u.y);
    float3 gl = float3(du.x * lerp(b - a, e - c, u.y), du.y * (lerp(c, e, u.x) - lerp(a, b, u.x)), 0);
    float3 gh = float3(du.x * lerp(h - g, k - j, u.y), du.y * (lerp(j, k, u.x) - lerp(g, h, u.x)), 0);
    float3 gr = lerp(gl, gh, u.z);
    gr.z = du.z * (hi - lo);
    grad += gr * freq * amp;
    amp *= 0.5; freq *= 2.3;
}
// Browser (x,y,z) -> Unreal (x,z,y) for the gradient, then keep the tangential part.
float3 gU = float3(grad.x, grad.z, grad.y);
gU -= radial * dot(gU, radial);
return normalize(radial - gU * Strength);
"""
w_waves = custom('WaterWaves', WAVE_HLSL, ['UV1', 'UV2', 'UV5', 'UV6', 'Time', 'Strength'], -800, -200)
wire(w_uv[1], '', w_waves, 'UV1'); wire(w_uv[2], '', w_waves, 'UV2'); wire(w_uv[5], '', w_waves, 'UV5'); wire(w_uv[6], '', w_waves, 'UV6')
wire(w_time, '', w_waves, 'Time'); wire(w_amp, '', w_waves, 'Strength')
connect(w_waves, [''], unreal.MaterialProperty.MP_NORMAL, 'WaterWaves -> Normal')

w_base = node(unreal.MaterialExpressionConstant3Vector, -800, -450, constant=unreal.LinearColor(0.02, 0.06, 0.09, 1.0))
connect(w_base, [''], unreal.MaterialProperty.MP_BASE_COLOR, 'water colour -> Base Color')
w_rough = node(unreal.MaterialExpressionConstant, -800, -380, r=0.03)
connect(w_rough, [''], unreal.MaterialProperty.MP_ROUGHNESS, '0.03 -> Roughness')
w_spec = node(unreal.MaterialExpressionConstant, -800, -320, r=0.255)
connect(w_spec, [''], unreal.MaterialProperty.MP_SPECULAR, '0.255 -> Specular')

# Absorption / scattering per centimetre: red dies within metres, blue carries.
slw = node(unreal.MaterialExpressionSingleLayerWaterMaterialOutput, -300, 200)
w_scatter = node(unreal.MaterialExpressionConstant3Vector, -800, 450, constant=unreal.LinearColor(0.00008, 0.00025, 0.00035, 1.0))
w_absorb = node(unreal.MaterialExpressionConstant3Vector, -800, 550, constant=unreal.LinearColor(0.0040, 0.0011, 0.0004, 1.0))
w_phase = node(unreal.MaterialExpressionConstant, -800, 650, r=0.7)
wire(w_scatter, '', slw, 'ScatteringCoefficients')
wire(w_absorb, '', slw, 'AbsorptionCoefficients')
wire(w_phase, '', slw, 'PhaseG')

mel.recompile_material(material)
lib.save_asset(PATH)
unreal.log('create_materials: saved %s; all connections ok=%s' % (PATH, ok))

# =============================== M_Vegetation ==================================
# Vertex-coloured, two-sided, for the placeholder trees and grass. Swap in real
# assets with their own materials whenever you have them.
material, PATH = fresh_material('M_Vegetation')
material.set_editor_property('two_sided', True)
v_color = node(unreal.MaterialExpressionVertexColor, -600, -100)
connect(v_color, [''], unreal.MaterialProperty.MP_BASE_COLOR, 'Vertex Color -> Base Color')
v_rough = node(unreal.MaterialExpressionConstant, -600, 50, r=0.85)
connect(v_rough, [''], unreal.MaterialProperty.MP_ROUGHNESS, '0.85 -> Roughness')
mel.recompile_material(material)
lib.save_asset(PATH)
unreal.log('create_materials: saved %s; all connections ok=%s' % (PATH, ok))

if not ok:
    unreal.log_error('create_materials: some pins failed; open the materials and check the graphs')
