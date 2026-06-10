fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().plugin(
            "install",
            tauri_build::InlinedPlugin::new().commands(&["install_apk"]),
        ),
    )
    .expect("failed to run tauri-build");
}
