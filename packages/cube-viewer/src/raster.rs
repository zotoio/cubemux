use fontdue::Font;

const BG: [u8; 4] = [24, 24, 32, 255];
const FG: [u8; 4] = [220, 220, 220, 255];
const CELL_W: usize = 9;
const CELL_H: usize = 18;
const COLS: usize = 80;
const ROWS: usize = 24;

pub struct FaceRaster {
    pub width: u32,
    pub height: u32,
    pub pixels: Vec<u8>,
}

pub fn rasterize_terminal_text(text: &str, font: &Font) -> FaceRaster {
    let width = COLS * CELL_W;
    let height = ROWS * CELL_H;
    let mut pixels = vec![0u8; width * height * 4];
    for px in pixels.chunks_mut(4) {
        px.copy_from_slice(&BG);
    }

    let mut fg = FG;
    let lines: Vec<&str> = text.lines().take(ROWS).collect();

    for (row, line) in lines.iter().enumerate() {
        let mut col = 0usize;
        let mut chars = line.chars().peekable();
        while col < COLS {
            if let Some(ch) = chars.next() {
                if ch == '\x1b' {
                    parse_ansi(&mut chars, &mut fg);
                    continue;
                }
                if ch == '\r' {
                    continue;
                }
                draw_char(font, &mut pixels, width, col, row, ch, fg);
                col += 1;
            } else {
                break;
            }
        }
    }

    FaceRaster {
        width: width as u32,
        height: height as u32,
        pixels,
    }
}

fn parse_ansi(chars: &mut std::iter::Peekable<std::str::Chars>, fg: &mut [u8; 4]) {
    let mut buf = String::new();
    while let Some(ch) = chars.next() {
        if ch == 'm' {
            apply_sgr(&buf, fg);
            return;
        }
        buf.push(ch);
    }
}

fn apply_sgr(code: &str, fg: &mut [u8; 4]) {
    for part in code.split(';') {
        match part {
            "0" | "" => *fg = FG,
            "1" => fg[0] = fg[0].saturating_add(30),
            "31" => *fg = [255, 120, 120, 255],
            "32" => *fg = [120, 255, 120, 255],
            "33" => *fg = [255, 255, 120, 255],
            "34" => *fg = [120, 160, 255, 255],
            "35" => *fg = [255, 120, 255, 255],
            "36" => *fg = [120, 255, 255, 255],
            "37" => *fg = [240, 240, 240, 255],
            _ => {}
        }
    }
}

fn draw_char(
    font: &Font,
    pixels: &mut [u8],
    width: usize,
    col: usize,
    row: usize,
    ch: char,
    fg: [u8; 4],
) {
    let (metrics, bitmap) = font.rasterize(ch, 14.0);
    let base_x = col * CELL_W + 1;
    let base_y = row * CELL_H + (CELL_H - metrics.height) / 2;

    for y in 0..metrics.height {
        for x in 0..metrics.width {
            let alpha = bitmap[y * metrics.width + x];
            if alpha == 0 {
                continue;
            }
            let px = base_x + x + metrics.xmin.max(0) as usize;
            let py = base_y + y;
            if px >= width || py >= ROWS * CELL_H {
                continue;
            }
            let idx = (py * width + px) * 4;
            blend_pixel(&mut pixels[idx..idx + 4], fg, alpha);
        }
    }
}

fn blend_pixel(dst: &mut [u8], fg: [u8; 4], alpha: u8) {
    let a = alpha as f32 / 255.0;
    for i in 0..3 {
        dst[i] = ((1.0 - a) * dst[i] as f32 + a * fg[i] as f32) as u8;
    }
    dst[3] = 255;
}

pub fn load_font() -> Font {
    let paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
        "/usr/share/fonts/truetype/ubuntu/UbuntuMono-R.ttf",
    ];
    for path in paths {
        if let Ok(bytes) = std::fs::read(path) {
            if let Ok(font) = Font::from_bytes(bytes, fontdue::FontSettings::default()) {
                return font;
            }
        }
    }
    // Minimal built-in fallback: fontdue accepts any TTF; use DejaVu if present at runtime only.
    panic!("no monospace font found; install fonts-dejavu-core");
}
