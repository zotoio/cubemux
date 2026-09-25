use std::process::Command;

pub fn capture_pane(socket: &str, pane: &str) -> String {
    let output = Command::new("tmux")
        .args([
            "-S",
            socket,
            "capture-pane",
            "-t",
            pane,
            "-p",
            "-e",
        ])
        .output();

    match output {
        Ok(out) if out.status.success() => String::from_utf8_lossy(&out.stdout).to_string(),
        _ => String::new(),
    }
}
