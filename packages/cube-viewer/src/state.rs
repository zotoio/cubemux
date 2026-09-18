use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::os::unix::io::AsRawFd;
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

fn lock_exclusive(file: &std::fs::File) -> bool {
    let fd = file.as_raw_fd();
    unsafe { libc::flock(fd, libc::LOCK_EX) == 0 }
}

fn unlock(file: &std::fs::File) {
    let fd = file.as_raw_fd();
    unsafe {
        libc::flock(fd, libc::LOCK_UN);
    }
}

fn update_state_json(path: &Path, update: impl FnOnce(&mut serde_json::Value)) {
    let mut file = match OpenOptions::new()
        .read(true)
        .write(true)
        .open(path)
    {
        Ok(file) => file,
        Err(_) => return,
    };
    if !lock_exclusive(&file) {
        return;
    }
    let mut text = String::new();
    if file.read_to_string(&mut text).is_err() {
        unlock(&file);
        return;
    }
    let mut value = match serde_json::from_str::<serde_json::Value>(&text) {
        Ok(value) => value,
        Err(_) => {
            unlock(&file);
            return;
        }
    };
    update(&mut value);
    let out = serde_json::to_string_pretty(&value).unwrap_or_default();
    if file.seek(SeekFrom::Start(0)).is_ok()
        && file.set_len(0).is_ok()
        && file.write_all(out.as_bytes()).is_ok()
    {
        let _ = file.sync_all();
    }
    unlock(&file);
}

pub fn write_fold_progress(path: &Path, progress: f32, folded: bool) {
    update_state_json(path, |value| {
        if let Some(obj) = value.as_object_mut() {
            obj.insert(
                "foldProgress".into(),
                serde_json::json!(progress.clamp(0.0, 1.0)),
            );
            obj.insert("folded".into(), serde_json::json!(folded));
        }
    });
}

pub fn write_rotation(path: &Path, yaw: f32, pitch: f32) {
    update_state_json(path, |value| {
        if let Some(obj) = value.as_object_mut() {
            if let Some(rot) = obj.get_mut("rotation").and_then(|r| r.as_object_mut()) {
                rot.insert("yaw".into(), serde_json::json!(yaw));
                rot.insert("pitch".into(), serde_json::json!(pitch));
                rot.insert("y".into(), serde_json::json!(yaw));
                rot.insert("x".into(), serde_json::json!(pitch));
            }
        }
    });
}

pub fn state_path_from_cwd(cwd: &Path) -> PathBuf {
    cwd.join(".cubemux").join("state.json")
}
