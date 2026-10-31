#!/usr/bin/env python3
"""
OURSPACE Brand Asset Generator
Generates pristine multi-resolution Windows .ico, Android adaptive icons,
iOS App Store master icons, splash screens, and web PWA assets.
"""

import os
from PIL import Image, ImageDraw, ImageFont

def create_heart_icon(size):
    """Draws an elegant rose-pink intertwined couple heart with glassmorphic glow."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = size * 0.08
    # Rounded background card
    card_bounds = [margin, margin, size - margin, size - margin]
    corner_radius = size * 0.22
    
    # Soft romantic gradient-like background fill
    # Warm cream to gentle rose-tinted white
    draw.rounded_rectangle(card_bounds, radius=int(corner_radius), fill=(255, 248, 248, 255), outline=(254, 205, 211, 230), width=max(1, int(size * 0.02)))

    # Dual Heart path coordinates
    scale = size / 512.0
    center_x = size / 2.0
    center_y = size / 2.0

    # Draw primary rose heart (#F43F5E)
    # Using smooth curve arcs and polygon base
    h_width = 160 * scale
    h_height = 150 * scale
    
    # Left lobe
    draw.ellipse([center_x - h_width + 10 * scale, center_y - h_height, center_x + 10 * scale, center_y], fill=(244, 63, 94, 255))
    # Right lobe
    draw.ellipse([center_x - 10 * scale, center_y - h_height, center_x + h_width - 10 * scale, center_y], fill=(251, 113, 133, 255))
    # Bottom triangle
    triangle = [
        (center_x - h_width + 20 * scale, center_y - h_height / 3),
        (center_x + h_width - 20 * scale, center_y - h_height / 3),
        (center_x, center_y + h_height * 0.85)
    ]
    draw.polygon(triangle, fill=(244, 63, 94, 255))

    # Inner sparkling accent heart (#FFFFFF glow)
    inner_w = 40 * scale
    inner_h = 38 * scale
    draw.ellipse([center_x - inner_w - 20 * scale, center_y - inner_h - 25 * scale, center_x - 20 * scale, center_y - 25 * scale], fill=(255, 255, 255, 180))

    return img

def create_splash_screen(width=1280, height=860):
    """Draws a romantic high-resolution desktop & tablet splash screen."""
    img = Image.new("RGB", (width, height), (255, 241, 242)) # Soft rose tint
    draw = ImageDraw.Draw(img)

    # Central subtle glow circle
    cx, cy = width // 2, height // 2
    r = int(min(width, height) * 0.35)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 248, 248))

    # Center icon
    icon_size = int(min(width, height) * 0.3)
    icon = create_heart_icon(icon_size)
    img.paste(icon, (cx - icon_size // 2, cy - icon_size // 2 - 40), icon)

    return img

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assets_dir = os.path.join(base_dir, "apppackage", "assets")
    icons_dir = os.path.join(assets_dir, "icons")
    branding_dir = os.path.join(assets_dir, "branding")
    mobile_assets_dir = os.path.join(base_dir, "apps", "mobile", "assets")
    web_public_dir = os.path.join(base_dir, "apps", "web", "public")
    desktop_assets_dir = os.path.join(base_dir, "apps", "desktop", "assets")

    for d in [icons_dir, branding_dir, mobile_assets_dir, web_public_dir, desktop_assets_dir]:
        os.makedirs(d, exist_ok=True)

    print("Generating master 1024x1024 icon...")
    master_icon = create_heart_icon(1024)
    master_icon.save(os.path.join(branding_dir, "icon-master-1024.png"), "PNG")

    # Generate iOS Icons
    ios_dir = os.path.join(icons_dir, "ios")
    os.makedirs(ios_dir, exist_ok=True)
    master_icon.resize((1024, 1024), Image.Resampling.LANCZOS).save(os.path.join(ios_dir, "icon-1024.png"))
    master_icon.resize((180, 180), Image.Resampling.LANCZOS).save(os.path.join(ios_dir, "icon-180.png"))
    master_icon.resize((120, 120), Image.Resampling.LANCZOS).save(os.path.join(ios_dir, "icon-120.png"))

    # Generate Android Icons
    android_dir = os.path.join(icons_dir, "android")
    os.makedirs(android_dir, exist_ok=True)
    master_icon.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(android_dir, "icon-512.png"))
    master_icon.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(android_dir, "icon-192.png"))
    master_icon.resize((144, 144), Image.Resampling.LANCZOS).save(os.path.join(android_dir, "icon-144.png"))
    master_icon.resize((96, 96), Image.Resampling.LANCZOS).save(os.path.join(android_dir, "icon-96.png"))
    master_icon.resize((432, 432), Image.Resampling.LANCZOS).save(os.path.join(android_dir, "adaptive-icon.png"))

    # Generate Windows Multi-resolution ICO (16, 24, 32, 48, 64, 128, 256)
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    ico_images = [master_icon.resize(s, Image.Resampling.LANCZOS) for s in ico_sizes]
    
    windows_ico_path = os.path.join(icons_dir, "icon.ico")
    ico_images[0].save(windows_ico_path, format="ICO", sizes=ico_sizes, append_images=ico_images[1:])
    # Copy to apps/desktop/assets/icon.ico
    ico_images[0].save(os.path.join(desktop_assets_dir, "icon.ico"), format="ICO", sizes=ico_sizes, append_images=ico_images[1:])

    # Generate Mobile App assets
    master_icon.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(mobile_assets_dir, "icon.png"))
    master_icon.resize((432, 432), Image.Resampling.LANCZOS).save(os.path.join(mobile_assets_dir, "adaptive-icon.png"))
    master_icon.resize((48, 48), Image.Resampling.LANCZOS).save(os.path.join(mobile_assets_dir, "favicon.png"))

    # Generate Splash screens
    splash = create_splash_screen(1280, 860)
    splash.save(os.path.join(branding_dir, "splash.png"), "PNG")
    splash.save(os.path.join(mobile_assets_dir, "splash.png"), "PNG")

    # Generate Web Public PWA assets
    master_icon.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(web_public_dir, "icon-512.png"))
    master_icon.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(web_public_dir, "icon-192.png"))
    master_icon.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(web_public_dir, "favicon.png"))
    ico_images[0].save(os.path.join(web_public_dir, "favicon.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

    print("Successfully generated brand assets across Windows, Android, iOS, and Web!")

if __name__ == "__main__":
    main()
