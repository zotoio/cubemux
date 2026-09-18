use glam::{Mat4, Vec3};

/// Grid index → cube face id per product spec:
/// Front=0, Right=1, Back=2, Left=3, Top=4, Bottom=5
pub fn face_normal(index: u8) -> Vec3 {
    match index {
        0 => Vec3::new(0.0, 0.0, 1.0),  // front
        1 => Vec3::new(1.0, 0.0, 0.0),  // right
        2 => Vec3::new(0.0, 0.0, -1.0), // back
        3 => Vec3::new(-1.0, 0.0, 0.0), // left
        4 => Vec3::new(0.0, 1.0, 0.0),  // top
        5 => Vec3::new(0.0, -1.0, 0.0), // bottom
        _ => Vec3::Z,
    }
}

pub fn grid_position(index: u8) -> Vec3 {
    let col = (index % 3) as f32;
    let row = (index / 3) as f32;
    let x = (col - 1.0) * 2.2;
    let y = (0.5 - row) * 1.6;
    Vec3::new(x, y, 0.0)
}

pub fn cube_transform(index: u8) -> Mat4 {
    let n = face_normal(index);
    let up = if index == 4 {
        Vec3::new(0.0, 0.0, -1.0)
    } else if index == 5 {
        Vec3::new(0.0, 0.0, 1.0)
    } else {
        Vec3::Y
    };
    let right = up.cross(n).normalize();
    let corrected_up = n.cross(right);
    let model = Mat4::from_cols(
        right.extend(0.0),
        corrected_up.extend(0.0),
        n.extend(0.0),
        (n * 0.5).extend(1.0),
    );
    Mat4::from_scale(Vec3::splat(0.95)) * model
}

pub fn grid_transform(index: u8) -> Mat4 {
    let pos = grid_position(index);
    Mat4::from_translation(pos) * Mat4::from_scale(Vec3::new(2.0, 1.4, 1.0))
}

pub fn face_transform(index: u8, fold_t: f32) -> Mat4 {
    let g = grid_transform(index);
    let c = cube_transform(index);
    let t = fold_t.clamp(0.0, 1.0);
    lerp_mat4(g, c, t)
}

fn lerp_mat4(a: Mat4, b: Mat4, t: f32) -> Mat4 {
    Mat4::from_cols(
        a.x_axis.lerp(b.x_axis, t),
        a.y_axis.lerp(b.y_axis, t),
        a.z_axis.lerp(b.z_axis, t),
        a.w_axis.lerp(b.w_axis, t),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mapping_indices() {
        assert_eq!(face_normal(0), Vec3::new(0.0, 0.0, 1.0));
        assert_eq!(face_normal(5), Vec3::new(0.0, -1.0, 0.0));
    }
}
