mod capture;
mod geometry;
mod raster;
mod renderer;
mod state;

use clap::Parser;
use state::{read_session_state, state_path_from_cwd, write_fold_progress, write_rotation};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};
use winit::application::ApplicationHandler;
use winit::dpi::LogicalSize;
use winit::event::{ElementState, MouseButton, WindowEvent};
use winit::event_loop::{ActiveEventLoop, EventLoop};
use winit::keyboard::{Key, NamedKey};
use winit::window::{Window, WindowAttributes, WindowId};

#[derive(Parser, Debug)]
#[command(name = "cubemux-cube-viewer")]
struct Args {
    #[arg(long)]
    cwd: PathBuf,
    #[arg(long, default_value = "0.85")]
    default_alpha: f32,
}

struct App {
    window: Option<Arc<Window>>,
    renderer: Option<renderer::Renderer>,
    font: fontdue::Font,
    state_path: PathBuf,
    fold_t: f32,
    target_fold: f32,
    yaw: f32,
    pitch: f32,
    dragging: bool,
    last_mouse: (f64, f64),
    active_face: Option<u8>,
    last_capture: Instant,
    exit_after_unfold: bool,
    args: Args,
}

impl App {
    fn new(args: Args) -> Self {
        Self {
            window: None,
            renderer: None,
            font: raster::load_font(),
            state_path: state_path_from_cwd(&args.cwd),
            fold_t: 0.0,
            target_fold: 1.0,
            yaw: 0.5,
            pitch: 0.25,
            dragging: false,
            last_mouse: (0.0, 0.0),
            active_face: None,
            last_capture: Instant::now() - Duration::from_secs(1),
            exit_after_unfold: false,
            args,
        }
    }

    fn sync_from_disk(&mut self) {
        if let Some(session) = read_session_state(&self.state_path) {
            self.target_fold = if session.folded { 1.0 } else { 0.0 };
            self.yaw = session.rotation.yaw.to_radians();
            self.pitch = session.rotation.pitch.to_radians();
            if session.rotation.yaw == 0.0 && session.rotation.pitch == 0.0 {
                self.yaw = session.rotation.y.to_radians();
                self.pitch = session.rotation.x.to_radians();
            }
        }
    }

    fn capture_faces(&mut self) {
        let session = read_session_state(&self.state_path);
        if session.is_none() {
            return;
        }
        let session = session.unwrap();
        let renderer = self.renderer.as_mut();
        if renderer.is_none() {
            return;
        }
        let renderer = renderer.unwrap();

        for face in &session.faces {
            let pane = face.tmux_pane_id.clone().unwrap_or_default();
            if pane.is_empty() {
                continue;
            }
            let text = capture::capture_pane(&session.socket_path, &pane);
            let raster = raster::rasterize_terminal_text(&text, &self.font);
            renderer.update_face_texture(face.index as usize, &raster);
        }
    }

    fn persist_rotation(&self) {
        write_rotation(
            &self.state_path,
            self.yaw.to_degrees(),
            self.pitch.to_degrees(),
        );
    }
}

impl ApplicationHandler for App {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        if self.window.is_some() {
            return;
        }
        let attrs = WindowAttributes::default()
            .with_title("cubemux cube")
            .with_inner_size(LogicalSize::new(1280.0, 800.0))
            .with_transparent(true);
        let window = Arc::new(
            event_loop
                .create_window(attrs)
                .expect("failed to create window"),
        );
        let renderer = pollster::block_on(renderer::Renderer::new(window.clone()));
        self.window = Some(window);
        self.renderer = Some(renderer);
        self.sync_from_disk();
        self.capture_faces();
    }

    fn window_event(
        &mut self,
        event_loop: &ActiveEventLoop,
        _id: WindowId,
        event: WindowEvent,
    ) {
        match event {
            WindowEvent::CloseRequested => {
                write_fold_progress(&self.state_path, self.fold_t, false);
                event_loop.exit();
            }
            WindowEvent::Resized(size) => {
                if let Some(renderer) = self.renderer.as_mut() {
                    renderer.resize(size.width, size.height);
                }
            }
            WindowEvent::MouseInput { state, button, .. } => {
                if button == MouseButton::Left {
                    self.dragging = state == ElementState::Pressed;
                }
            }
            WindowEvent::CursorMoved { position, .. } => {
                if self.dragging {
                    let (x, y) = (position.x, position.y);
                    let dx = x - self.last_mouse.0;
                    let dy = y - self.last_mouse.1;
                    self.yaw += dx as f32 * 0.005;
                    self.pitch = (self.pitch + dy as f32 * 0.005).clamp(-1.2, 1.2);
                    self.persist_rotation();
                }
                self.last_mouse = (position.x, position.y);
            }
            WindowEvent::KeyboardInput { event, .. } => {
                if event.state != ElementState::Pressed {
                    return;
                }
                match event.logical_key {
                    Key::Named(NamedKey::ArrowLeft) => self.yaw -= 0.08,
                    Key::Named(NamedKey::ArrowRight) => self.yaw += 0.08,
                    Key::Named(NamedKey::ArrowUp) => {
                        self.pitch = (self.pitch + 0.08).clamp(-1.2, 1.2)
                    }
                    Key::Named(NamedKey::ArrowDown) => {
                        self.pitch = (self.pitch - 0.08).clamp(-1.2, 1.2)
                    }
                    Key::Named(NamedKey::Escape) => event_loop.exit(),
                    Key::Character(ch) => {
                        if let Some(c) = ch.chars().next() {
                            if c.is_ascii_digit() {
                                self.active_face = Some((c as u8) - b'0');
                            }
                        }
                    }
                    _ => {}
                }
                self.persist_rotation();
            }
            WindowEvent::RedrawRequested => {
                let prev_target_fold = self.target_fold;
                self.sync_from_disk();
                if prev_target_fold > 0.5 && self.target_fold <= 0.5 {
                    self.exit_after_unfold = true;
                }

                let step = 0.04;
                if self.fold_t < self.target_fold {
                    self.fold_t = (self.fold_t + step).min(self.target_fold);
                } else if self.fold_t > self.target_fold {
                    self.fold_t = (self.fold_t - step).max(self.target_fold);
                }
                write_fold_progress(
                    &self.state_path,
                    self.fold_t,
                    self.target_fold > 0.5,
                );

                if self.last_capture.elapsed() > Duration::from_millis(250) {
                    self.capture_faces();
                    self.last_capture = Instant::now();
                }

                if let Some(renderer) = self.renderer.as_mut() {
                    renderer.render(self.fold_t, self.yaw, self.pitch, self.active_face);
                }

                if let Some(window) = &self.window {
                    window.request_redraw();
                }

                if self.exit_after_unfold && self.target_fold == 0.0 && self.fold_t <= 0.01 {
                    event_loop.exit();
                }
            }
            _ => {}
        }
    }

    fn about_to_wait(&mut self, _event_loop: &ActiveEventLoop) {
        if let Some(window) = &self.window {
            window.request_redraw();
        }
    }
}

fn main() {
    let args = Args::parse();
    let event_loop = EventLoop::new().expect("event loop");
    let mut app = App::new(args);
    event_loop.run_app(&mut app).expect("run");
}
