use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FaceRuntimeState {
    pub index: u8,
    pub name: String,
    #[serde(rename = "type")]
    pub face_type: String,
    #[serde(rename = "tmuxPaneId")]
    pub tmux_pane_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RotationState {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    #[serde(default)]
    pub yaw: f32,
    #[serde(default)]
    pub pitch: f32,
}

impl Default for RotationState {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            z: 0.0,
            yaw: 0.0,
            pitch: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub project: String,
    #[serde(rename = "socketPath")]
    pub socket_path: String,
    #[serde(rename = "windowName")]
    pub window_name: String,
    pub running: bool,
    pub faces: Vec<FaceRuntimeState>,
    pub folded: bool,
    #[serde(rename = "foldProgress", default)]
    pub fold_progress: f32,
    pub rotation: RotationState,
    #[serde(rename = "viewerPid", default)]
    pub viewer_pid: Option<u32>,
}

pub fn read_session_state(path: &Path) -> Option<SessionState> {
    let text = fs::read_to_string(path).ok()?;
    if text.trim().is_empty() {
        return None;
    }
    serde_json::from_str(&text).ok()
}

pub fn write_fold_progress(path: &Path, progress: f32, folded: bool) {
    if let Ok(text) = fs::read_to_string(path) {
        if let Ok(mut value) = serde_json::from_str::<serde_json::Value>(&text) {
            if let Some(obj) = value.as_object_mut() {
                obj.insert(
                    "foldProgress".into(),
                    serde_json::json!(progress.clamp(0.0, 1.0)),
                );
                obj.insert("folded".into(), serde_json::json!(folded));
                let _ = fs::write(path, serde_json::to_string_pretty(&value).unwrap_or_default());
            }
        }
    }
}

pub fn write_rotation(path: &Path, yaw: f32, pitch: f32) {
    if let Ok(text) = fs::read_to_string(path) {
        if let Ok(mut value) = serde_json::from_str::<serde_json::Value>(&text) {
            if let Some(obj) = value.as_object_mut() {
                if let Some(rot) = obj.get_mut("rotation").and_then(|r| r.as_object_mut()) {
                    rot.insert("yaw".into(), serde_json::json!(yaw));
                    rot.insert("pitch".into(), serde_json::json!(pitch));
                    rot.insert("y".into(), serde_json::json!(yaw));
                    rot.insert("x".into(), serde_json::json!(pitch));
                }
                let _ = fs::write(path, serde_json::to_string_pretty(&value).unwrap_or_default());
            }
        }
    }
}

pub fn state_path_from_cwd(cwd: &Path) -> PathBuf {
    cwd.join(".cubemux").join("state.json")
}
