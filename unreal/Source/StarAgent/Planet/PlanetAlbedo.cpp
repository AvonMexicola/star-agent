#include "PlanetAlbedo.h"
#include "AeonSurface.h"
#include "Async/ParallelFor.h"
#include "Engine/Texture2D.h"
#include "TextureResource.h"

namespace StarAgent {

static uint8 ToSrgb8(double linear)
{
	linear = FMath::Clamp(linear, 0.0, 1.0);
	const double s = linear <= 0.0031308 ? linear * 12.92 : 1.055 * FMath::Pow(linear, 1.0 / 2.4) - 0.055;
	return static_cast<uint8>(FMath::RoundToInt(s * 255.0));
}

static uint8 ToUnorm8(double v) { return static_cast<uint8>(FMath::RoundToInt(FMath::Clamp(v, 0.0, 1.0) * 255.0)); }

void BakeAeonAlbedo(uint32 Seed, int32 Width, int32 Height, TArray<uint8>& OutBgra, TArray<uint8>& OutFields)
{
	OutBgra.SetNumUninitialized(static_cast<int64>(Width) * Height * 4);
	OutFields.SetNumUninitialized(static_cast<int64>(Width) * Height * 4);
	uint8* Pixels = OutBgra.GetData();
	uint8* FieldPixels = OutFields.GetData();
	ParallelFor(Height, [&](int32 j)
	{
		const double lat = 90.0 - 180.0 * (j + 0.5) / Height;
		for (int32 i = 0; i < Width; i++)
		{
			const double lon = -180.0 + 360.0 * (i + 0.5) / Width;
			double d[3], rgb[3];
			Aeon::LatLonDirection(lat, lon, d);
			const double h = Aeon::TerrainHeight(d[0], d[1], d[2], Seed);
			const double slope = Aeon::SlopeAt(d[0], d[1], d[2], h, Seed);
			Aeon::SurfaceColor(d[0], d[1], d[2], h, slope, Seed, rgb);
			double m, n, fine;
			Aeon::SurfaceFields(d[0], d[1], d[2], Seed, m, n, fine);
			uint8* p = Pixels + (static_cast<int64>(j) * Width + i) * 4;
			p[0] = ToSrgb8(rgb[2]); p[1] = ToSrgb8(rgb[1]); p[2] = ToSrgb8(rgb[0]); p[3] = ToUnorm8(m);
			uint8* q = FieldPixels + (static_cast<int64>(j) * Width + i) * 4;
			q[0] = 0; q[1] = ToUnorm8(fine); q[2] = ToUnorm8(n); q[3] = 255;  // BGRA: r = n, g = fine
		}
	});
}

// Box filter in sRGB space; good enough for a distance map.
static void Downsample(const TArray<uint8>& Src, int32 W, int32 H, TArray<uint8>& Dst, int32& OutW, int32& OutH)
{
	OutW = FMath::Max(1, W / 2); OutH = FMath::Max(1, H / 2);
	Dst.SetNumUninitialized(static_cast<int64>(OutW) * OutH * 4);
	for (int32 y = 0; y < OutH; y++) for (int32 x = 0; x < OutW; x++)
	{
		const int32 x0 = FMath::Min(x * 2, W - 1), x1 = FMath::Min(x * 2 + 1, W - 1), y0 = FMath::Min(y * 2, H - 1), y1 = FMath::Min(y * 2 + 1, H - 1);
		for (int32 c = 0; c < 4; c++)
		{
			const int32 sum = Src[(static_cast<int64>(y0) * W + x0) * 4 + c] + Src[(static_cast<int64>(y0) * W + x1) * 4 + c]
				+ Src[(static_cast<int64>(y1) * W + x0) * 4 + c] + Src[(static_cast<int64>(y1) * W + x1) * 4 + c];
			Dst[(static_cast<int64>(y) * OutW + x) * 4 + c] = static_cast<uint8>((sum + 2) / 4);
		}
	}
}

UTexture2D* CreateAlbedoTexture(int32 Width, int32 Height, const TArray<uint8>& Bgra, const FName& Name, bool bSRGB)
{
	UTexture2D* Texture = UTexture2D::CreateTransient(Width, Height, PF_B8G8R8A8, Name, TConstArrayView64<uint8>(Bgra.GetData(), Bgra.Num()));
	if (!Texture) return nullptr;
	FTexturePlatformData* PlatformData = Texture->GetPlatformData();
	TArray<uint8> Current = Bgra; int32 W = Width, H = Height;
	while (W > 1 || H > 1)
	{
		TArray<uint8> Next; int32 NW, NH;
		Downsample(Current, W, H, Next, NW, NH);
		FTexture2DMipMap* Mip = new FTexture2DMipMap(NW, NH, 1);
		Mip->BulkData.Lock(LOCK_READ_WRITE);
		void* Data = Mip->BulkData.Realloc(Next.Num());
		FMemory::Memcpy(Data, Next.GetData(), Next.Num());
		Mip->BulkData.Unlock();
		PlatformData->Mips.Add(Mip);
		Current = MoveTemp(Next); W = NW; H = NH;
	}
	Texture->SRGB = bSRGB;
	Texture->Filter = TF_Trilinear;
	Texture->AddressX = TA_Wrap;   // longitude wraps
	Texture->AddressY = TA_Clamp;  // latitude does not
	Texture->NeverStream = true;
	Texture->UpdateResource();
	return Texture;
}

} // namespace StarAgent
