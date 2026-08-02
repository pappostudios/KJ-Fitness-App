"""
store_screenshots.py

Converts raw app screenshots (any resolution — e.g. simulator/device captures)
into the exact pixel dimensions required by Apple App Store Connect and
Google Play Console, across the standard device buckets.

Apple (iPhone 6.5", iPhone 6.9", iPad 12.9") requires exact target
dimensions per bucket — screenshots that don't match one of the accepted
sizes are rejected outright. Google Play has no such fixed buckets for
phone screenshots (just a min/max px and aspect-ratio range), but does
have two fixed "tablet" size classes if you choose to supply them.

Note: Apple periodically revises which display-size buckets are mandatory
vs. auto-generated from your largest upload — re-check current App Store
Connect requirements before a real submission. Google Play requires
screenshots to be flat (no alpha channel), which this script handles.

Dependencies: Pillow  ->  pip install Pillow

Usage:
    from store_screenshots import StoreScreenshotConverter

    conv = StoreScreenshotConverter(output_dir="dist/store_screenshots")
    conv.convert_directory("raw_screenshots/")          # every profile
    conv.convert_all("raw_screenshots/home.png", profiles=["ios_6_5"])

    # CLI:
    python store_screenshots.py raw_screenshots/ -o dist/store_screenshots
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from PIL import Image

FitMode = Literal["cover", "contain"]

# App background fallback used to pad "contain"-fit images (matches the
# KJ Fitness light-theme screen background, #F7FCFC).
DEFAULT_PAD_COLOR = (0xF7, 0xFC, 0xFC, 255)


@dataclass(frozen=True)
class DeviceProfile:
    """One required screenshot slot for a store submission."""
    store: str            # "app_store" | "play_store"
    label: str             # output subfolder name, e.g. "iphone_6_9"
    width: int
    height: int
    fit: FitMode = "cover"
    pad_color: tuple[int, int, int, int] = field(default=DEFAULT_PAD_COLOR)
    strip_alpha: bool = False  # Play Store rejects screenshots with alpha


# ── Device/store profiles ───────────────────────────────────────────────────
PROFILES: dict[str, DeviceProfile] = {
    # Apple App Store Connect — required screenshot sizes, portrait.
    "ios_6_5": DeviceProfile("app_store", "iphone_6_5in", 1284, 2778),
    "ios_6_9": DeviceProfile("app_store", "iphone_6_9in", 1320, 2868),
    "ios_ipad_12_9": DeviceProfile("app_store", "ipad_12_9in", 2048, 2732),

    # Google Play Console — phone screenshots accept a range (min 320px,
    # max 3840px per side, aspect ratio between 16:9 and 9:16); 1080x1920
    # is a safe, widely-used target. Tablet sets are optional but fixed.
    "android_phone": DeviceProfile("play_store", "phone", 1080, 1920, strip_alpha=True),
    "android_tablet_7": DeviceProfile("play_store", "tablet_7in", 1200, 1920, strip_alpha=True),
    "android_tablet_10": DeviceProfile("play_store", "tablet_10in", 1600, 2560, strip_alpha=True),
}


class StoreScreenshotConverter:
    """Batch-converts raw screenshots into every required store/device size."""

    def __init__(self, output_dir: str | Path, profiles: dict[str, DeviceProfile] | None = None):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.profiles = profiles or PROFILES

    # ── Core resize logic ────────────────────────────────────────────────
    @staticmethod
    def _cover(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
        """Scale to fill the target, cropping overflow — no letterboxing."""
        src_w, src_h = img.size
        scale = max(target_w / src_w, target_h / src_h)
        new_w, new_h = round(src_w * scale), round(src_h * scale)
        resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        left = (new_w - target_w) // 2
        top = (new_h - target_h) // 2
        return resized.crop((left, top, left + target_w, top + target_h))

    @staticmethod
    def _contain(
        img: Image.Image, target_w: int, target_h: int, pad_color: tuple[int, int, int, int]
    ) -> Image.Image:
        """Scale to fit inside the target, padding the remainder with pad_color."""
        src_w, src_h = img.size
        scale = min(target_w / src_w, target_h / src_h)
        new_w, new_h = round(src_w * scale), round(src_h * scale)
        resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (target_w, target_h), pad_color)
        canvas.paste(resized, ((target_w - new_w) // 2, (target_h - new_h) // 2), resized)
        return canvas

    def _fit(self, img: Image.Image, profile: DeviceProfile) -> Image.Image:
        img = img.convert("RGBA")
        if profile.fit == "cover":
            out = self._cover(img, profile.width, profile.height)
        else:
            out = self._contain(img, profile.width, profile.height, profile.pad_color)
        if profile.strip_alpha:
            out = out.convert("RGB")
        return out

    # ── Public API ───────────────────────────────────────────────────────
    def convert_one(self, src_path: str | Path, profile_key: str) -> Path:
        """Convert a single screenshot to a single profile; returns the output path."""
        profile = self.profiles[profile_key]
        with Image.open(src_path) as img:
            out = self._fit(img, profile)

        store_dir = self.output_dir / profile.store / profile.label
        store_dir.mkdir(parents=True, exist_ok=True)
        out_path = store_dir / f"{Path(src_path).stem}.png"
        out.save(out_path, "PNG")
        return out_path

    def convert_all(self, src_path: str | Path, profiles: list[str] | None = None) -> list[Path]:
        """Convert a single screenshot to every requested profile (default: all)."""
        keys = profiles or list(self.profiles.keys())
        return [self.convert_one(src_path, key) for key in keys]

    def convert_directory(
        self,
        src_dir: str | Path,
        profiles: list[str] | None = None,
        extensions: tuple[str, ...] = (".png", ".jpg", ".jpeg"),
    ) -> list[Path]:
        """Convert every screenshot in a directory to every requested profile."""
        src_dir = Path(src_dir)
        results: list[Path] = []
        for f in sorted(src_dir.iterdir()):
            if f.is_file() and f.suffix.lower() in extensions:
                results.extend(self.convert_all(f, profiles))
        return results


def _cli() -> None:
    parser = argparse.ArgumentParser(
        description="Convert screenshots to App Store / Play Store required sizes."
    )
    parser.add_argument("input", help="Screenshot file or directory of screenshots")
    parser.add_argument("-o", "--output", default="store_screenshots", help="Output directory")
    parser.add_argument(
        "-p", "--profiles", nargs="*", default=None,
        help=f"Subset of profiles to generate (default: all). Choices: {list(PROFILES)}",
    )
    args = parser.parse_args()

    conv = StoreScreenshotConverter(args.output)
    src = Path(args.input)
    outputs = conv.convert_directory(src, args.profiles) if src.is_dir() else conv.convert_all(src, args.profiles)

    print(f"Generated {len(outputs)} screenshot(s) in {args.output}/")
    for p in outputs:
        print(" ", p)


if __name__ == "__main__":
    _cli()
